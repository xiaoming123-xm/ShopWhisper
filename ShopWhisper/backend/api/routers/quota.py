"""
配额管理 API 路由
"""
from fastapi import APIRouter

from api.dependencies import DBDep, TenantFlexDep
from schemas.base import ApiResponse
from schemas.quota import QuotaUsageResponse
from services.quota_service import QuotaService

router = APIRouter(prefix="/quota", tags=["配额管理"])


@router.get("/usage", response_model=ApiResponse[QuotaUsageResponse])
async def get_quota_usage(
    tenant_id: TenantFlexDep,
    db: DBDep,
):
    """获取当月配额使用情况"""
    quota_service = QuotaService(db)
    quota = await quota_service.get_or_create_quota(tenant_id)

    # 获取加量包余额
    addon = await quota_service._get_addon_credit(tenant_id)
    image_addon_balance = addon.image_gen_balance if addon else 0
    video_addon_balance = addon.video_gen_balance if addon else 0

    await db.commit()

    return ApiResponse(
        data=QuotaUsageResponse(
            billing_period=quota.billing_period,
            reply_used=quota.reply_used,
            reply_unlimited=True,
            image_gen_quota=quota.image_gen_quota,
            image_gen_used=quota.image_gen_used,
            image_gen_addon_balance=image_addon_balance,
            video_gen_quota=quota.video_gen_quota,
            video_gen_used=quota.video_gen_used,
            video_gen_addon_balance=video_addon_balance,
        )
    )
