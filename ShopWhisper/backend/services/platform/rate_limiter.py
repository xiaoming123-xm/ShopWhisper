"""平台 API 速率限制器（基于 Redis 令牌桶）"""
import asyncio
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# 各平台 API 限制配置
PLATFORM_LIMITS: dict[str, dict[str, int]] = {
    "pinduoduo": {"calls_per_second": 10, "calls_per_minute": 300},
    "douyin": {"calls_per_second": 10, "calls_per_minute": 500},
    "taobao": {"calls_per_second": 40, "calls_per_minute": 2000},
    "jd": {"calls_per_second": 20, "calls_per_minute": 600},
    "kuaishou": {"calls_per_second": 10, "calls_per_minute": 300},
}


class RateLimiter:
    """基于 Redis 的滑动窗口速率限制器"""

    def __init__(self, redis_client=None):
        self._redis = redis_client

    async def _get_redis(self):
        if self._redis is None:
            from db.redis import get_redis
            self._redis = await get_redis()
        return self._redis

    async def acquire(self, platform_type: str, shop_id: str = "global") -> bool:
        """获取调用许可

        Returns:
            True 如果允许调用，False 如果被限流
        """
        limits = PLATFORM_LIMITS.get(platform_type)
        if not limits:
            return True

        redis = await self._get_redis()
        key = f"rate_limit:{platform_type}:{shop_id}"
        now = datetime.utcnow().timestamp()

        # 使用 Redis sorted set 实现滑动窗口
        pipe = redis.pipeline()
        # 清除 60 秒前的记录
        pipe.zremrangebyscore(key, 0, now - 60)
        # 统计当前窗口内的请求数
        pipe.zcard(key)
        results = await pipe.execute()

        current_count = results[1]
        max_per_minute = limits["calls_per_minute"]

        if current_count >= max_per_minute:
            logger.warning(
                "API 速率限制: %s/%s 已达上限 %d/%d",
                platform_type, shop_id, current_count, max_per_minute,
            )
            return False

        # 记录本次请求
        await redis.zadd(key, {f"{now}": now})
        await redis.expire(key, 120)  # 2分钟过期

        return True

    async def wait_and_acquire(
        self, platform_type: str, shop_id: str = "global", max_wait: float = 10.0
    ) -> bool:
        """等待直到获得调用许可或超时"""
        waited = 0.0
        interval = 0.5

        while waited < max_wait:
            if await self.acquire(platform_type, shop_id):
                return True
            await asyncio.sleep(interval)
            waited += interval

        return False


# 全局实例
rate_limiter = RateLimiter()
