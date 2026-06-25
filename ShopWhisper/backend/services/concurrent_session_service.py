"""
并发会话管理服务

系统级保护，防止单租户耗尽资源。并发限制从系统配置读取，
而非订阅配额（配额系统已移除）。
"""
from redis.asyncio import Redis

from core.config import settings


class ConcurrentSessionManager:
    """并发会话管理器"""

    def __init__(self, redis: Redis):
        self.redis = redis
        self.limit = settings.max_concurrent_sessions_per_tenant

    def _key(self, tenant_id: str) -> str:
        return f"concurrent:{tenant_id}"

    async def acquire(self, tenant_id: str, conversation_id: str) -> bool:
        """
        获取并发槽位

        Args:
            tenant_id: 租户ID
            conversation_id: 会话ID

        Returns:
            bool: 是否成功获取槽位
        """
        key = self._key(tenant_id)
        current_count = await self.redis.scard(key)

        if current_count >= self.limit:
            return False

        await self.redis.sadd(key, conversation_id)
        await self.redis.expire(key, 86400)  # 24小时安全过期
        return True

    async def release(self, tenant_id: str, conversation_id: str):
        """
        释放并发槽位

        Args:
            tenant_id: 租户ID
            conversation_id: 会话ID
        """
        key = self._key(tenant_id)
        await self.redis.srem(key, conversation_id)

    async def get_active_count(self, tenant_id: str) -> int:
        """
        获取当前活跃会话数

        Args:
            tenant_id: 租户ID

        Returns:
            int: 活跃会话数
        """
        key = self._key(tenant_id)
        count = await self.redis.scard(key)
        return count or 0

    async def get_active_conversations(self, tenant_id: str) -> set[str]:
        """
        获取所有活跃会话ID

        Args:
            tenant_id: 租户ID

        Returns:
            set[str]: 活跃会话ID集合
        """
        key = self._key(tenant_id)
        members = await self.redis.smembers(key)
        return {m.decode() if isinstance(m, bytes) else m for m in members}

    async def cleanup_expired(self, tenant_id: str, active_conversation_ids: set[str]):
        """
        清理已过期的会话

        Args:
            tenant_id: 租户ID
            active_conversation_ids: 当前实际活跃的会话ID集合
        """
        key = self._key(tenant_id)
        cached = await self.get_active_conversations(tenant_id)
        expired = cached - active_conversation_ids

        if expired:
            await self.redis.srem(key, *expired)
