"""统一存储服务 (使用 TOS 后端)"""
import os
import uuid
import logging
from urllib.parse import urlparse
from typing import ClassVar

import httpx

from core.config import settings
from .storage.tos_backend import TosStorageBackend

logger = logging.getLogger(__name__)


class StorageService:
    """统一存储服务 (使用 TOS 后端)"""

    _backend: ClassVar[TosStorageBackend | None] = None

    @classmethod
    def get_backend(cls) -> TosStorageBackend:
        """获取 TOS 存储后端单例"""
        if cls._backend is None:
            cls._backend = TosStorageBackend()
            logger.info("Initialized TOS storage backend")
        return cls._backend

    @classmethod
    async def download_and_store(
        cls, url: str, prefix: str, tenant_id: str
    ) -> str:
        """下载远程文件并存储到 TOS,返回 object_name"""
        parsed = urlparse(url)
        path = parsed.path
        ext = os.path.splitext(path)[1] or ".bin"
        if len(ext) > 10:
            ext = ".bin"

        object_name = f"{tenant_id}/{prefix}/{uuid.uuid4().hex}{ext}"

        # 下载文件
        async with httpx.AsyncClient(timeout=120, follow_redirects=True) as http:
            resp = await http.get(url)
            resp.raise_for_status()
            data = resp.content
            content_type = resp.headers.get("content-type", "application/octet-stream")

        # 上传到 TOS
        backend = cls.get_backend()
        backend.put_object(object_name, data, content_type)

        logger.info(f"Stored object: {object_name} ({len(data)} bytes)")
        return object_name

    @classmethod
    def get_public_url(cls, object_name: str) -> str:
        """生成公开访问 URL (预签名 URL)"""
        backend = cls.get_backend()
        return backend.get_public_url(object_name)

    @classmethod
    def delete_object(cls, object_name: str) -> None:
        """删除对象"""
        backend = cls.get_backend()
        backend.delete_object(object_name)

    # 保留旧的 get_client 方法以兼容可能的直接调用
    @classmethod
    def get_client(cls):
        """兼容方法: 返回 TOS 后端"""
        return cls.get_backend()
