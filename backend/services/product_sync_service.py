"""商品同步服务"""
import logging
from datetime import datetime, timedelta

from sqlalchemy import and_, select, func, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from models.knowledge import KnowledgeBase
from models.platform import PlatformConfig
from models.product import (
    PlatformSyncTask, Product, ProductSyncSchedule,
    SyncTaskStatus, SyncTarget, SyncType,
)
from services.knowledge_service import KnowledgeService
from services.platform.adapter_factory import create_adapter

logger = logging.getLogger(__name__)


class ProductSyncService:
    """商品同步服务

    负责从电商平台拉取商品数据，写入 Product 表，
    并自动生成知识库条目。
    """

    def __init__(self, db: AsyncSession, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id

    # ===== 商品 CRUD =====

    async def list_products(
        self,
        keyword: str | None = None,
        category: str | None = None,
        status: str | None = None,
        platform_config_id: int | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Product], int]:
        """查询商品列表"""
        conditions = [Product.tenant_id == self.tenant_id]
        if keyword:
            conditions.append(Product.title.ilike(f"%{keyword}%"))
        if category:
            conditions.append(Product.category == category)
        if status:
            conditions.append(Product.status == status)
        if platform_config_id:
            conditions.append(Product.platform_config_id == platform_config_id)

        # 总数
        count_stmt = select(func.count(Product.id)).where(and_(*conditions))
        total = (await self.db.execute(count_stmt)).scalar() or 0

        # 分页
        stmt = (
            select(Product)
            .where(and_(*conditions))
            .order_by(Product.updated_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        result = await self.db.execute(stmt)
        products = list(result.scalars().all())

        return products, total

    async def get_product(self, product_id: int) -> Product | None:
        """获取商品详情"""
        stmt = select(Product).where(
            and_(Product.id == product_id, Product.tenant_id == self.tenant_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    def estimate_listing_price(
        self,
        title: str,
        category: str,
        material: str,
        cost: float,
        stock: int,
        target_platform: str = "douyin_demo",
        color: str | None = None,
        size: str | None = None,
    ) -> dict:
        """规则版智能估价，用于商品上架演示。"""
        text = f"{title} {category} {material}".lower()
        is_knitwear = any(word in text for word in ["针织", "毛衣", "knit", "sweater"])
        material_multiplier = 1.0
        if any(word in text for word in ["羊毛", "羊绒", "cashmere", "wool"]):
            material_multiplier += 0.28
        elif any(word in text for word in ["棉", "cotton"]):
            material_multiplier += 0.12
        elif any(word in text for word in ["腈纶", "混纺", "acrylic"]):
            material_multiplier += 0.08

        category_anchor_map = {
            "服装": 169,
            "服饰": 169,
            "针织": 169,
            "电子": 399,
            "数码": 399,
            "家居": 129,
            "美妆": 99,
            "食品": 59,
        }
        category_anchor = next((price for key, price in category_anchor_map.items() if key in category), 129)
        if is_knitwear:
            category_anchor = max(category_anchor, 169)
        marketplace_prices = self._mock_marketplace_prices(category, material, cost)
        competitor_avg = sum(item["price"] for item in marketplace_prices) / len(marketplace_prices)
        season_multiplier = 1.08 if datetime.utcnow().month in [9, 10, 11, 12, 1, 2] else 1.0
        platform_multiplier = 1.06 if "douyin" in target_platform else 1.0
        stock_multiplier = 1.08 if stock <= 20 else 0.97 if stock >= 100 else 1.0
        spec_multiplier = 1.03 if (size and size.upper() in ["XL", "XXL", "2XL"]) else 1.0
        cost_price = max(cost * 2.2, cost + 39)
        anchor_price = (category_anchor + cost_price + competitor_avg) / 3
        suggested = anchor_price * material_multiplier * season_multiplier * platform_multiplier * stock_multiplier * spec_multiplier
        suggested = round(min(max(suggested, cost * 1.35), cost * 3.8 + 60), 2)
        min_price = round(max(cost * 1.25, suggested * 0.84), 2)
        max_price = round(max(suggested + 20, suggested * 1.18), 2)

        reasons = [
            "参考淘宝、京东等平台同类商品模拟价格",
            "结合成本、材质、库存压力计算利润空间",
            "抖音演示渠道按内容电商转化预留轻微溢价",
        ]
        if stock <= 20:
            reasons.append("库存较少，建议保留稀缺性溢价")
        elif stock >= 100:
            reasons.append("库存较高，建议价格略收敛以加快动销")

        return {
            "suggested_price": suggested,
            "min_price": min_price,
            "max_price": max_price,
            "confidence": 0.82,
            "reasons": reasons,
            "pricing_factors": {
                "cost": round(cost, 2),
                "category_anchor": category_anchor,
                "competitor_avg": round(competitor_avg, 2),
                "material_multiplier": round(material_multiplier, 2),
                "season_multiplier": round(season_multiplier, 2),
                "platform_multiplier": round(platform_multiplier, 2),
                "stock_multiplier": round(stock_multiplier, 2),
                "spec_multiplier": round(spec_multiplier, 2),
                "color": color or "",
                "size": size or "",
                "marketplace_samples": marketplace_prices,
            },
        }

    def _mock_marketplace_prices(self, category: str, material: str, cost: float) -> list[dict[str, float | str]]:
        base = max(cost * 2.1, cost + 45)
        category_boost = 1.25 if any(key in category for key in ["电子", "数码"]) else 1.08
        material_boost = 1.18 if any(key in material for key in ["羊毛", "真皮", "金属"]) else 1.0
        anchor = base * category_boost * material_boost
        return [
            {"platform": "淘宝", "price": round(anchor * 0.92, 2)},
            {"platform": "京东", "price": round(anchor * 1.08, 2)},
            {"platform": "抖音", "price": round(anchor * 1.02, 2)},
        ]

    async def publish_demo_listing(
        self,
        platform_config_id: int,
        title: str,
        category: str,
        material: str,
        cost: float,
        stock: int,
        image_url: str | None = None,
        description: str | None = None,
        final_price: float | None = None,
        original_price: float | None = None,
        promo_prompt: str | None = None,
        target_platform: str = "douyin_demo",
        color: str | None = None,
        size: str | None = None,
    ) -> tuple[Product, dict, dict]:
        """创建或更新演示上架商品，并同步库存/价格/状态。"""
        estimate = self.estimate_listing_price(
            title=title,
            category=category,
            material=material,
            cost=cost,
            stock=stock,
            target_platform=target_platform,
            color=color,
            size=size,
        )
        platform_product_id = f"demo-{self.tenant_id}-{abs(hash((title, category, color, size))) % 1000000}"
        stmt = select(Product).where(
            and_(
                Product.tenant_id == self.tenant_id,
                Product.platform_config_id == platform_config_id,
                Product.platform_product_id == platform_product_id,
            )
        )
        product = (await self.db.execute(stmt)).scalar_one_or_none()
        old_stock = int(product.stock) if product else 0
        price = final_price or estimate["suggested_price"]
        final_description = description or "?????????????????????????"
        if promo_prompt:
            final_description = f"{final_description}\n\n?????{promo_prompt}"

        product_data = {
            "title": title,
            "description": description or "浅紫色绞花针织毛衣，上架演示商品，适合秋冬通勤和日常穿搭。",
            "price": price,
            "original_price": original_price or round(price * 1.22, 2),
            "category": category,
            "images": [image_url] if image_url else [],
            "videos": [],
            "attributes": {
                "material": material,
                "color": color or "浅紫色",
                "size": size or "均码",
                "style": "上架演示",
                "target_platform": target_platform,
                "promo_prompt": promo_prompt or "",
                "smart_price_range": [estimate["min_price"], estimate["max_price"]],
                "marketplace_samples": estimate["pricing_factors"].get("marketplace_samples", []),
            },
            "sales_count": int(product.sales_count) if product else 0,
            "stock": stock,
            "status": "active",
            "platform_data": {
                "listing_mode": "demo",
                "platform": "抖音模拟" if "douyin" in target_platform else "本地演示",
                "pricing_reasons": estimate["reasons"],
                "promo_prompt": promo_prompt or "",
                "published_at": datetime.utcnow().isoformat(),
            },
            "last_synced_at": datetime.utcnow(),
        }

        if product:
            for key, value in product_data.items():
                setattr(product, key, value)
        else:
            product = Product(
                tenant_id=self.tenant_id,
                platform_config_id=platform_config_id,
                platform_product_id=platform_product_id,
                **product_data,
            )
            self.db.add(product)

        await self.db.commit()
        await self.db.refresh(product)
        inventory_change = {
            "before_stock": old_stock,
            "after_stock": stock,
            "delta": stock - old_stock,
        }
        return product, estimate, inventory_change

    # ===== 同步逻辑 =====

    async def trigger_sync(
        self, platform_config_id: int, sync_type: str = "full"
    ) -> PlatformSyncTask:
        """触发同步任务"""
        # 检查是否有正在运行的同步任务
        stmt = select(PlatformSyncTask).where(
            and_(
                PlatformSyncTask.tenant_id == self.tenant_id,
                PlatformSyncTask.platform_config_id == platform_config_id,
                PlatformSyncTask.sync_target == SyncTarget.PRODUCT.value,
                PlatformSyncTask.status.in_([
                    SyncTaskStatus.PENDING.value,
                    SyncTaskStatus.RUNNING.value,
                ]),
            )
        )
        existing = (await self.db.execute(stmt)).scalar_one_or_none()
        if existing:
            raise ValueError("已有正在运行的同步任务，请等待完成后再试")

        task = PlatformSyncTask(
            tenant_id=self.tenant_id,
            platform_config_id=platform_config_id,
            sync_target=SyncTarget.PRODUCT.value,
            sync_type=sync_type,
            status=SyncTaskStatus.PENDING.value,
        )
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)
        return task

    async def execute_sync(self, task_id: int) -> None:
        """执行同步任务（由 Celery Task 调用）"""
        stmt = select(PlatformSyncTask).where(PlatformSyncTask.id == task_id)
        task = (await self.db.execute(stmt)).scalar_one_or_none()
        if not task:
            logger.error("同步任务不存在: %d", task_id)
            return

        # 获取平台配置
        config_stmt = select(PlatformConfig).where(
            PlatformConfig.id == task.platform_config_id
        )
        config = (await self.db.execute(config_stmt)).scalar_one_or_none()
        if not config:
            task.status = SyncTaskStatus.FAILED.value
            task.error_message = "平台配置不存在"
            await self.db.commit()
            return

        # 更新任务状态
        task.status = SyncTaskStatus.RUNNING.value
        task.started_at = datetime.utcnow()
        await self.db.commit()

        try:
            adapter = create_adapter(config)

            if task.sync_type == SyncType.FULL.value:
                await self._full_sync(adapter, config.id, task)
            else:
                await self._incremental_sync(adapter, config.id, task)

            task.status = SyncTaskStatus.COMPLETED.value
            task.completed_at = datetime.utcnow()
        except Exception as e:
            logger.exception("同步任务失败: %d", task_id)
            task.status = SyncTaskStatus.FAILED.value
            task.error_message = str(e)
            task.completed_at = datetime.utcnow()

        await self.db.commit()

    async def _full_sync(
        self, adapter, platform_config_id: int, task: PlatformSyncTask
    ) -> None:
        """全量同步"""
        page = 1
        page_size = 50
        total_synced = 0
        total_failed = 0

        while True:
            result = await adapter.fetch_products(page=page, page_size=page_size)
            task.total_count = result.total

            for dto in result.items:
                try:
                    await self._upsert_product(platform_config_id, dto)
                    total_synced += 1
                except Exception as e:
                    logger.error("同步商品失败 %s: %s", dto.platform_product_id, e)
                    total_failed += 1

            task.synced_count = total_synced
            task.failed_count = total_failed
            await self.db.commit()

            if page * page_size >= result.total:
                break
            page += 1

    async def _incremental_sync(
        self, adapter, platform_config_id: int, task: PlatformSyncTask
    ) -> None:
        """增量同步"""
        # 获取上次同步时间
        schedule_stmt = select(ProductSyncSchedule).where(
            and_(
                ProductSyncSchedule.tenant_id == self.tenant_id,
                ProductSyncSchedule.platform_config_id == platform_config_id,
            )
        )
        schedule = (await self.db.execute(schedule_stmt)).scalar_one_or_none()
        since = schedule.last_run_at if schedule and schedule.last_run_at else (
            datetime.utcnow() - timedelta(hours=1)
        )

        updated_products = await adapter.fetch_updated_products(since)
        task.total_count = len(updated_products)

        total_synced = 0
        total_failed = 0
        for dto in updated_products:
            try:
                await self._upsert_product(platform_config_id, dto)
                total_synced += 1
            except Exception as e:
                logger.error("增量同步商品失败 %s: %s", dto.platform_product_id, e)
                total_failed += 1

        task.synced_count = total_synced
        task.failed_count = total_failed

        # 更新调度时间
        if schedule:
            schedule.last_run_at = datetime.utcnow()
            schedule.next_run_at = datetime.utcnow() + timedelta(minutes=schedule.interval_minutes)

    async def _upsert_product(self, platform_config_id: int, dto) -> Product:
        """新增或更新商品"""
        stmt = select(Product).where(
            and_(
                Product.tenant_id == self.tenant_id,
                Product.platform_config_id == platform_config_id,
                Product.platform_product_id == dto.platform_product_id,
            )
        )
        product = (await self.db.execute(stmt)).scalar_one_or_none()

        if product:
            # 更新
            product.title = dto.title
            product.description = dto.description
            product.price = dto.price
            product.original_price = dto.original_price
            product.category = dto.category
            product.images = dto.images
            product.videos = dto.videos
            product.attributes = dto.attributes
            product.sales_count = dto.sales_count
            product.stock = dto.stock
            product.status = dto.status
            product.platform_data = dto.platform_data
            product.last_synced_at = datetime.utcnow()
        else:
            # 新建
            product = Product(
                tenant_id=self.tenant_id,
                platform_config_id=platform_config_id,
                platform_product_id=dto.platform_product_id,
                title=dto.title,
                description=dto.description,
                price=dto.price,
                original_price=dto.original_price,
                category=dto.category,
                images=dto.images,
                videos=dto.videos,
                attributes=dto.attributes,
                sales_count=dto.sales_count,
                stock=dto.stock,
                status=dto.status,
                platform_data=dto.platform_data,
                last_synced_at=datetime.utcnow(),
            )
            self.db.add(product)

        await self.db.flush()

        # 自动生成/更新知识库条目
        await self._sync_to_knowledge_base(product)

        return product

    async def _sync_to_knowledge_base(self, product: Product) -> None:
        """将商品信息同步到知识库"""
        # 格式化商品知识内容
        content_parts = [
            f"商品名称：{product.title}",
            f"价格：{product.price}元",
        ]
        if product.original_price:
            content_parts.append(f"原价：{product.original_price}元")
        if product.category:
            content_parts.append(f"分类：{product.category}")
        if product.description:
            content_parts.append(f"描述：{product.description}")
        if product.attributes:
            content_parts.append(f"规格：{product.attributes}")
        content_parts.append(f"库存：{product.stock}")
        content_parts.append(f"销量：{product.sales_count}")

        content = "\n".join(content_parts)

        if product.knowledge_base_id:
            # 更新已有知识库条目
            await self.db.execute(
                sa_update(KnowledgeBase)
                .where(KnowledgeBase.id == product.knowledge_base_id)
                .values(
                    title=product.title,
                    content=content,
                    category=product.category,
                    updated_at=datetime.utcnow(),
                )
            )
        else:
            # 创建新的知识库条目
            knowledge_service = KnowledgeService(self.db, self.tenant_id)
            kb = await knowledge_service.create_knowledge(
                knowledge_type="product",
                title=product.title,
                content=content,
                category=product.category,
                tags=["商品", "自动同步"],
            )
            product.knowledge_base_id = kb.id

    # ===== 同步调度 =====

    async def get_sync_schedule(self, platform_config_id: int) -> ProductSyncSchedule | None:
        """获取同步调度配置"""
        stmt = select(ProductSyncSchedule).where(
            and_(
                ProductSyncSchedule.tenant_id == self.tenant_id,
                ProductSyncSchedule.platform_config_id == platform_config_id,
            )
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def update_sync_schedule(
        self,
        platform_config_id: int,
        interval_minutes: int | None = None,
        is_active: bool | None = None,
    ) -> ProductSyncSchedule:
        """创建或更新同步调度配置"""
        schedule = await self.get_sync_schedule(platform_config_id)

        if not schedule:
            schedule = ProductSyncSchedule(
                tenant_id=self.tenant_id,
                platform_config_id=platform_config_id,
                interval_minutes=interval_minutes or 60,
                is_active=1 if is_active is not False else 0,
                next_run_at=datetime.utcnow() + timedelta(minutes=interval_minutes or 60),
            )
            self.db.add(schedule)
        else:
            if interval_minutes is not None:
                schedule.interval_minutes = interval_minutes
            if is_active is not None:
                schedule.is_active = 1 if is_active else 0
            if interval_minutes:
                schedule.next_run_at = datetime.utcnow() + timedelta(minutes=interval_minutes)

        await self.db.commit()
        await self.db.refresh(schedule)
        return schedule

    # ===== 同步任务查询 =====

    async def list_sync_tasks(
        self, platform_config_id: int | None = None, page: int = 1, size: int = 20
    ) -> tuple[list[PlatformSyncTask], int]:
        """查询同步任务列表"""
        conditions = [
            PlatformSyncTask.tenant_id == self.tenant_id,
            PlatformSyncTask.sync_target == SyncTarget.PRODUCT.value,
        ]
        if platform_config_id:
            conditions.append(PlatformSyncTask.platform_config_id == platform_config_id)

        count_stmt = select(func.count(PlatformSyncTask.id)).where(and_(*conditions))
        total = (await self.db.execute(count_stmt)).scalar() or 0

        stmt = (
            select(PlatformSyncTask)
            .where(and_(*conditions))
            .order_by(PlatformSyncTask.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        result = await self.db.execute(stmt)
        tasks = list(result.scalars().all())

        return tasks, total
