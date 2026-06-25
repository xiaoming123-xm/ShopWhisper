"""商品提示词模型"""
from enum import Enum
from sqlalchemy import String, Integer, Text, Index
from sqlalchemy.orm import Mapped, mapped_column
from models.base import TenantBaseModel


class PromptType(str, Enum):
    """提示词类型"""
    IMAGE = "image"
    VIDEO = "video"
    TITLE = "title"
    DESCRIPTION = "description"


class ProductPrompt(TenantBaseModel):
    """商品提示词表"""
    __tablename__ = "product_prompts"
    __table_args__ = (
        Index("idx_product_prompt_tenant", "tenant_id"),
        Index("idx_product_prompt_product", "product_id"),
        Index("idx_product_prompt_product_type", "product_id", "prompt_type"),
        {"comment": "商品提示词表"},
    )

    product_id: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="关联商品ID"
    )
    prompt_type: Mapped[str] = mapped_column(
        String(32), nullable=False, comment="提示词类型(image/video/title/description)"
    )
    name: Mapped[str] = mapped_column(
        String(128), nullable=False, comment="提示词名称"
    )
    content: Mapped[str] = mapped_column(
        Text, nullable=False, comment="提示词内容"
    )
    usage_count: Mapped[int] = mapped_column(
        Integer, default=0, comment="使用次数"
    )

    def __repr__(self) -> str:
        return f"<ProductPrompt {self.name} ({self.prompt_type})>"
