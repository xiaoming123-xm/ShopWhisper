"""平台适配器工厂（桥接到 adapter_registry）"""
from models.platform import PlatformConfig
from services.platform.base_adapter import BasePlatformAdapter
from services.platform.adapter_registry import create_adapter as _create

# 确保适配器被导入和注册
import services.platform.pdd_adapter  # noqa: F401
import services.platform.douyin_adapter  # noqa: F401
import services.platform.taobao.adapter  # noqa: F401
import services.platform.jd.adapter  # noqa: F401
import services.platform.kuaishou.adapter  # noqa: F401


def create_adapter(config: PlatformConfig) -> BasePlatformAdapter:
    """兼容旧调用方式的工厂函数"""
    return _create(config)
