"""平台适配器注册表"""
import logging
from typing import Type

from core.crypto import decrypt_field
from models.platform import PlatformConfig
from models.platform_app import PlatformApp
from services.platform.base_adapter import BasePlatformAdapter

logger = logging.getLogger(__name__)

# 适配器注册表
_adapters: dict[str, Type[BasePlatformAdapter]] = {}


def register(platform_type: str):
    """装饰器：注册平台适配器类

    Usage:
        @register("taobao")
        class TaobaoAdapter(BasePlatformAdapter):
            ...
    """
    def decorator(cls: Type[BasePlatformAdapter]):
        _adapters[platform_type] = cls
        logger.info("注册平台适配器: %s -> %s", platform_type, cls.__name__)
        return cls
    return decorator


def create_adapter(
    config: PlatformConfig,
    app: PlatformApp | None = None,
) -> BasePlatformAdapter:
    """根据平台配置创建适配器实例

    Args:
        config: 商家级别的平台配置（含 access_token 等）
        app: ISV 应用配置（含 app_key/app_secret）。如果为 None，
             则从 config 中取 app_key/app_secret（兼容旧逻辑）。
    """
    adapter_cls = _adapters.get(config.platform_type)
    if not adapter_cls:
        raise ValueError(f"不支持的平台类型: {config.platform_type}")

    # 确定 app_key 和 app_secret 的来源
    if app:
        app_key = app.app_key
        try:
            app_secret = decrypt_field(app.app_secret)
        except Exception:
            app_secret = app.app_secret
    else:
        app_key = config.app_key
        try:
            app_secret = decrypt_field(config.app_secret)
        except Exception:
            app_secret = config.app_secret

    # 从 ISV 应用的 extra_config 中提取额外参数
    extra_kwargs = {}
    if app and app.extra_config:
        if app.extra_config.get("sandbox"):
            extra_kwargs["sandbox"] = True

    return adapter_cls(
        app_key=app_key,
        app_secret=app_secret,
        access_token=config.access_token,
        **extra_kwargs,
    )


def get_supported_platforms() -> list[str]:
    """获取所有已注册的平台类型"""
    return list(_adapters.keys())
