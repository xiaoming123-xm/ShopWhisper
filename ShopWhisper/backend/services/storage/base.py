"""存储后端抽象接口"""
from abc import ABC, abstractmethod
from typing import BinaryIO


class StorageBackend(ABC):
    """存储后端抽象接口"""

    @abstractmethod
    def put_object(
        self,
        object_name: str,
        data: bytes | BinaryIO,
        content_type: str = "application/octet-stream"
    ) -> None:
        """上传对象"""
        pass

    @abstractmethod
    def get_object(self, object_name: str) -> bytes:
        """下载对象"""
        pass

    @abstractmethod
    def delete_object(self, object_name: str) -> None:
        """删除对象"""
        pass

    @abstractmethod
    def get_public_url(self, object_name: str) -> str:
        """获取公开访问 URL"""
        pass

    @abstractmethod
    def ensure_bucket_exists(self) -> None:
        """确保 bucket 存在"""
        pass
