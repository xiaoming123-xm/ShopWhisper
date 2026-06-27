"""商品提示词 Schema"""
from pydantic import BaseModel, Field

from schemas.base import TimestampSchema


class ProductPromptCreate(BaseModel):
    """创建提示词"""
    product_id: int = Field(..., description="商品ID")
    prompt_type: str = Field(..., pattern="^(image|video|title|description)$", description="提示词类型")
    name: str = Field(..., min_length=1, max_length=128, description="提示词名称")
    content: str = Field(..., min_length=1, description="提示词内容")


class ProductPromptUpdate(BaseModel):
    """更新提示词"""
    name: str | None = Field(None, min_length=1, max_length=128)
    content: str | None = Field(None, min_length=1)


class ProductPromptResponse(TimestampSchema):
    """提示词响应"""
    id: int
    tenant_id: str
    product_id: int
    prompt_type: str
    name: str
    content: str
    usage_count: int
