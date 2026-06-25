"""
拼多多会话状态管理 — AI / 人工 模式切换（Redis 存储）
"""
from db.redis import get_redis

HUMAN_MODE_KEY_FMT = "pdd:human_mode:{conversation_id}"
HUMAN_MODE_TTL = 3600 * 8  # 8小时后自动恢复 AI 模式


class PddSessionManager:
    """管理拼多多会话的 AI/人工 模式状态"""

    def __init__(self, redis=None):
        self._redis = redis

    async def _get_redis(self):
        if self._redis is None:
            self._redis = await get_redis()
        return self._redis

    def _key(self, conversation_id: str) -> str:
        return HUMAN_MODE_KEY_FMT.format(conversation_id=conversation_id)

    async def set_human_mode(self, conversation_id: str, enabled: bool) -> None:
        redis = await self._get_redis()
        key = self._key(conversation_id)
        if enabled:
            await redis.set(key, "1", ex=HUMAN_MODE_TTL)
        else:
            await redis.delete(key)

    async def is_human_mode(self, conversation_id: str) -> bool:
        redis = await self._get_redis()
        val = await redis.get(self._key(conversation_id))
        return val is not None
