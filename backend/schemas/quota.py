"""
配额相关 Schemas
"""
from pydantic import BaseModel


class QuotaUsageResponse(BaseModel):
    """配额使用情况响应"""

    billing_period: str
    reply_used: int              # 保留统计
    reply_unlimited: bool = True  # 标记不限量
    image_gen_quota: int
    image_gen_used: int
    image_gen_addon_balance: int = 0  # 加量包剩余
    video_gen_quota: int
    video_gen_used: int
    video_gen_addon_balance: int = 0  # 加量包剩余

    class Config:
        from_attributes = True
