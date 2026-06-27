"""
租户加量包余额表模型
"""
from sqlalchemy import Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from models.base import BaseModel


class TenantAddonCredit(BaseModel):
    """租户加量包余额表（永久有效，不随月度重置）"""

    __tablename__ = "tenant_addon_credits"
    __table_args__ = (
        UniqueConstraint("tenant_id", name="uq_addon_credit_tenant"),
        Index("idx_addon_credit_tenant", "tenant_id"),
        {"comment": "租户加量包余额表"},
    )

    # 租户信息
    tenant_id: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="租户ID"
    )

    # 图片生成加量包余额
    image_gen_balance: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="图片生成剩余次数"
    )

    # 视频生成加量包余额
    video_gen_balance: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="视频生成剩余次数"
    )

    def __repr__(self) -> str:
        return f"<TenantAddonCredit {self.tenant_id} img={self.image_gen_balance} vid={self.video_gen_balance}>"
