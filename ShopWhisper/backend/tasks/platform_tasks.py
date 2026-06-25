"""平台对接定时任务"""
import logging
from datetime import datetime, timedelta

from tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.platform_tasks.refresh_expiring_tokens")
def refresh_expiring_tokens():
    """刷新即将过期的平台 access_token"""
    import asyncio
    asyncio.run(_refresh_expiring_tokens())


async def _refresh_expiring_tokens():
    from sqlalchemy import and_, select
    from db import get_db
    from models.platform import PlatformConfig
    from models.platform_app import PlatformApp
    from services.platform.adapter_registry import create_adapter

    # 确保适配器注册
    import services.platform.pdd_adapter  # noqa: F401
    import services.platform.douyin_adapter  # noqa: F401

    threshold = datetime.utcnow() + timedelta(hours=2)

    async for db in get_db():
        stmt = select(PlatformConfig).where(
            and_(
                PlatformConfig.is_active == True,
                PlatformConfig.refresh_token.isnot(None),
                PlatformConfig.expires_at <= threshold,
            )
        )
        result = await db.execute(stmt)
        configs = result.scalars().all()

        for config in configs:
            try:
                # 尝试获取 ISV 应用配置
                app_stmt = select(PlatformApp).where(
                    PlatformApp.platform_type == config.platform_type
                )
                app_result = await db.execute(app_stmt)
                app = app_result.scalar_one_or_none()

                adapter = create_adapter(config, app)
                token_result = await adapter.refresh_token(config.refresh_token)

                config.access_token = token_result.access_token
                config.refresh_token = token_result.refresh_token or config.refresh_token
                config.expires_at = datetime.utcnow() + timedelta(seconds=token_result.expires_in)
                config.token_expires_at = config.expires_at
                config.last_token_refresh = datetime.utcnow()
                config.authorization_status = "authorized"

                await db.commit()
                logger.info(
                    "已刷新 tenant=%s platform=%s 的 access_token",
                    config.tenant_id, config.platform_type,
                )
            except Exception as e:
                logger.error("刷新 token 失败 tenant=%s: %s", config.tenant_id, e)
                # 如果 refresh_token 也过期，标记授权过期
                if "expired" in str(e).lower() or "invalid" in str(e).lower():
                    config.authorization_status = "expired"
                    config.is_active = False
                    await db.commit()
                    logger.warning(
                        "tenant=%s platform=%s 的授权已过期，需要重新授权",
                        config.tenant_id, config.platform_type,
                    )
