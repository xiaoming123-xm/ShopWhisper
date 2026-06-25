# 存储服务

本项目使用火山引擎 TOS (Tencent Object Storage) 作为对象存储后端。

## 架构

- `base.py` - 存储后端抽象接口
- `tos_backend.py` - 火山引擎 TOS 实现
- `__init__.py` - 模块导出

## 配置

在 `.env` 文件或环境变量中配置：

```bash
STORAGE_BACKEND=tos
TOS_ACCESS_KEY=your-access-key
TOS_SECRET_KEY=your-secret-key
TOS_ENDPOINT=tos-cn-beijing.volces.com
TOS_REGION=cn-beijing
TOS_BUCKET=your-bucket-name
```

## 使用

```python
from services.storage_service import StorageService

# 下载并存储文件
object_name = await StorageService.download_and_store(
    url="https://example.com/image.jpg",
    prefix="images",
    tenant_id="tenant_123"
)

# 获取公开访问URL（预签名URL，有效期7天）
public_url = StorageService.get_public_url(object_name)

# 删除对象
StorageService.delete_object(object_name)
```

## 扩展其他存储后端

如需支持其他存储服务（如 AWS S3、阿里云 OSS 等），只需：

1. 继承 `StorageBackend` 抽象类
2. 实现所有抽象方法
3. 在 `storage_service.py` 中根据配置选择对应的后端

示例：

```python
from .base import StorageBackend

class S3StorageBackend(StorageBackend):
    def __init__(self):
        # 初始化 S3 客户端
        pass

    def put_object(self, object_name: str, data: bytes | BinaryIO, content_type: str) -> None:
        # 实现上传逻辑
        pass

    # ... 实现其他方法
```
