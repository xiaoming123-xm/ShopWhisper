"""
配额服务 - 配额检查、扣减、重置
"""
import logging
from datetime import datetime

from sqlalchemy import select, and_, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.permissions import get_quota_config
from models.addon_credit import TenantAddonCredit
from models.quota import TenantQuota
from models.tenant import Subscription

logger = logging.getLogger(__name__)


class QuotaExceededError(Exception):
    """配额超限异常"""

    def __init__(self, quota_type: str, quota: int, used: int):
        self.quota_type = quota_type
        self.quota = quota
        self.used = used
        super().__init__(
            f"{quota_type} 配额已用完（{used}/{quota}），本月无法继续使用"
        )


class QuotaService:
    """配额服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _current_period() -> str:
        """获取当前账期 (YYYY-MM)"""
        return datetime.utcnow().strftime("%Y-%m")

    async def _get_plan_type(self, tenant_id: str) -> str:
        """获取租户当前套餐类型"""
        stmt = select(Subscription.plan_type).where(
            and_(
                Subscription.tenant_id == tenant_id,
                Subscription.status == "active",
            )
        ).order_by(Subscription.created_at.desc()).limit(1)
        result = await self.db.execute(stmt)
        plan_type = result.scalar_one_or_none()
        return plan_type or "trial"

    async def get_or_create_quota(self, tenant_id: str) -> TenantQuota:
        """获取或创建当月配额记录"""
        period = self._current_period()
        stmt = select(TenantQuota).where(
            and_(
                TenantQuota.tenant_id == tenant_id,
                TenantQuota.billing_period == period,
            )
        )
        result = await self.db.execute(stmt)
        quota = result.scalar_one_or_none()

        if quota:
            return quota

        # 创建新配额记录
        plan_type = await self._get_plan_type(tenant_id)
        config = get_quota_config(plan_type)

        quota = TenantQuota(
            tenant_id=tenant_id,
            billing_period=period,
            reply_quota=0,
            reply_used=0,
            image_gen_quota=config["image_gen_quota"],
            image_gen_used=0,
            video_gen_quota=config["video_gen_quota"],
            video_gen_used=0,
        )
        self.db.add(quota)
        await self.db.flush()
        return quota

    async def _get_addon_credit(self, tenant_id: str) -> TenantAddonCredit | None:
        """获取租户加量包余额"""
        stmt = select(TenantAddonCredit).where(
            TenantAddonCredit.tenant_id == tenant_id
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def add_addon_credits(self, tenant_id: str, credit_type: str, amount: int) -> None:
        """增加加量包余额"""
        addon = await self._get_addon_credit(tenant_id)
        if not addon:
            addon = TenantAddonCredit(
                tenant_id=tenant_id,
                image_gen_balance=0,
                video_gen_balance=0,
            )
            self.db.add(addon)
            await self.db.flush()

        if credit_type == "image":
            addon.image_gen_balance += amount
        elif credit_type == "video":
            addon.video_gen_balance += amount
        await self.db.flush()

    async def check_reply_quota(self, tenant_id: str) -> TenantQuota:
        """AI回复不限量，直接返回（保留方法签名避免调用方报错）"""
        return await self.get_or_create_quota(tenant_id)

    async def check_image_quota(self, tenant_id: str) -> TenantQuota:
        """检查图片生成配额（月度配额 + 加量包余额）"""
        quota = await self.get_or_create_quota(tenant_id)
        if quota.image_gen_used < quota.image_gen_quota:
            return quota  # 月度配额未用完
        # 月度配额用完，检查加量包余额
        addon = await self._get_addon_credit(tenant_id)
        if addon and addon.image_gen_balance > 0:
            return quota  # 有加量包余额
        raise QuotaExceededError("图片生成", quota.image_gen_quota, quota.image_gen_used)

    async def check_video_quota(self, tenant_id: str) -> TenantQuota:
        """检查视频生成配额（月度配额 + 加量包余额）"""
        quota = await self.get_or_create_quota(tenant_id)
        if quota.video_gen_used < quota.video_gen_quota:
            return quota  # 月度配额未用完
        # 月度配额用完，检查加量包余额
        addon = await self._get_addon_credit(tenant_id)
        if addon and addon.video_gen_balance > 0:
            return quota  # 有加量包余额
        raise QuotaExceededError("视频生成", quota.video_gen_quota, quota.video_gen_used)

    async def increment_reply(self, tenant_id: str) -> None:
        """记录AI回复次数（仅统计，不限量）"""
        period = self._current_period()
        stmt = (
            update(TenantQuota)
            .where(
                and_(
                    TenantQuota.tenant_id == tenant_id,
                    TenantQuota.billing_period == period,
                )
            )
            .values(reply_used=TenantQuota.reply_used + 1)
        )
        await self.db.execute(stmt)

    async def increment_image(self, tenant_id: str) -> None:
        """扣减一次图片生成配额（优先月度，再扣加量包）"""
        quota = await self.get_or_create_quota(tenant_id)
        if quota.image_gen_used < quota.image_gen_quota:
            # 扣月度配额
            quota.image_gen_used += 1
        else:
            # 扣加量包余额
            addon = await self._get_addon_credit(tenant_id)
            if addon and addon.image_gen_balance > 0:
                addon.image_gen_balance -= 1
        await self.db.flush()

    async def increment_video(self, tenant_id: str) -> None:
        """扣减一次视频生成配额（优先月度，再扣加量包）"""
        quota = await self.get_or_create_quota(tenant_id)
        if quota.video_gen_used < quota.video_gen_quota:
            # 扣月度配额
            quota.video_gen_used += 1
        else:
            # 扣加量包余额
            addon = await self._get_addon_credit(tenant_id)
            if addon and addon.video_gen_balance > 0:
                addon.video_gen_balance -= 1
        await self.db.flush()

    async def reset_all_quotas(self, period: str) -> int:
        """
        为所有活跃租户创建新月度配额记录。
        由 Celery Beat 每月1号调用。
        返回创建的记录数。
        """
        # 查询所有活跃订阅的租户
        stmt = select(Subscription.tenant_id, Subscription.plan_type).where(
            Subscription.status == "active"
        )
        result = await self.db.execute(stmt)
        active_subs = result.all()

        count = 0
        for tenant_id, plan_type in active_subs:
            # 检查是否已存在该月记录
            existing = await self.db.execute(
                select(TenantQuota.id).where(
                    and_(
                        TenantQuota.tenant_id == tenant_id,
                        TenantQuota.billing_period == period,
                    )
                )
            )
            if existing.scalar_one_or_none():
                continue

            config = get_quota_config(plan_type)
            quota = TenantQuota(
                tenant_id=tenant_id,
                billing_period=period,
                reply_quota=0,
                reply_used=0,
                image_gen_quota=config["image_gen_quota"],
                image_gen_used=0,
                video_gen_quota=config["video_gen_quota"],
                video_gen_used=0,
            )
            self.db.add(quota)
            count += 1

        await self.db.flush()
        return count
