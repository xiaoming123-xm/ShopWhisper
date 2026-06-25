"""火山引擎 TOS 存储后端"""
import io
import logging
from typing import BinaryIO

import tos
from tos.exceptions import TosServerError, TosClientError

from .base import StorageBackend
from core.config import settings

logger = logging.getLogger(__name__)


class TosStorageBackend(StorageBackend):
    """火山引擎 TOS 存储后端"""

    def __init__(self):
        self.client = tos.TosClientV2(
            ak=settings.tos_access_key,
            sk=settings.tos_secret_key,
            endpoint=settings.tos_endpoint,
            region=settings.tos_region,
        )
        self.bucket = settings.tos_bucket
        self.ensure_bucket_exists()

    def ensure_bucket_exists(self) -> None:
        """确保 bucket 存在"""
        try:
            # 尝试获取 bucket 信息
            self.client.head_bucket(self.bucket)
            logger.info(f"TOS bucket exists: {self.bucket}")
        except TosServerError as e:
            if e.status_code == 404:
                # Bucket 不存在,创建它
                self.client.create_bucket(self.bucket)
                logger.info(f"Created TOS bucket: {self.bucket}")
            else:
                logger.error(f"Failed to check bucket: {e}")
                raise
        except Exception as e:
            logger.error(f"Unexpected error checking bucket: {e}")
            raise

    def put_object(self, object_name: str, data: bytes | BinaryIO, content_type: str) -> None:
        """上传对象到 TOS"""
        try:
            if isinstance(data, bytes):
                content = data
            else:
                content = data.read()

            self.client.put_object(
                bucket=self.bucket,
                key=object_name,
                content=content,
            )
            logger.info(f"Uploaded to TOS: {object_name} ({len(content)} bytes)")
        except (TosServerError, TosClientError) as e:
            logger.error(f"Failed to upload {object_name}: {e}")
            raise

    def get_object(self, object_name: str) -> bytes:
        """从 TOS 下载对象"""
        try:
            response = self.client.get_object(self.bucket, object_name)
            return response.read()
        except (TosServerError, TosClientError) as e:
            logger.error(f"Failed to download {object_name}: {e}")
            raise

    def delete_object(self, object_name: str) -> None:
        """从 TOS 删除对象"""
        try:
            self.client.delete_object(self.bucket, object_name)
            logger.info(f"Deleted from TOS: {object_name}")
        except TosServerError as e:
            if e.status_code == 404:
                logger.warning(f"Object not found: {object_name}")
            else:
                logger.warning(f"Failed to delete {object_name}: {e}")
        except Exception as e:
            logger.warning(f"Unexpected error deleting {object_name}: {e}")

    def get_public_url(self, object_name: str) -> str:
        """生成预签名 URL (有效期 7 天)"""
        try:
            from tos.enum import HttpMethodType
            result = self.client.pre_signed_url(
                http_method=HttpMethodType.Http_Method_Get,
                bucket=self.bucket,
                key=object_name,
                expires=7 * 24 * 3600,  # 7 天有效期
            )
            return result.signed_url
        except Exception as e:
            logger.error(f"Failed to generate pre-signed URL for {object_name}: {e}")
            # 回退方案: 返回直接 URL (需要 bucket 配置公开读)
            return f"https://{self.bucket}.{self.client.endpoint}/{object_name}"
