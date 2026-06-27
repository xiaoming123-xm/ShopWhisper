"""
平台对接配置模型
"""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.base import TenantBaseModel


class PlatformConfig(TenantBaseModel):
    """平台对接配置表"""

    __tablename__ = "platform_configs"
    __table_args__ = (
        Index("idx_platform_config_tenant_type_shop", "tenant_id", "platform_type", "shop_id"),
        {"comment": "电商平台对接配置表"},
    )

    # 平台标识
    platform_type: Mapped[str] = mapped_column(
        String(32), nullable=False, comment="平台类型(pinduoduo/taobao等)"
    )

    # OAuth 凭证
    app_key: Mapped[str] = mapped_column(String(128), nullable=False, comment="平台 App Key")
    app_secret: Mapped[str] = mapped_column(String(512), nullable=False, comment="平台 App Secret(加密存储)")
    access_token: Mapped[str | None] = mapped_column(String(512), comment="访问令牌")
    refresh_token: Mapped[str | None] = mapped_column(String(512), comment="刷新令牌")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, comment="令牌过期时间")

    # 店铺信息
    shop_id: Mapped[str | None] = mapped_column(String(64), comment="店铺ID")
    shop_name: Mapped[str | None] = mapped_column(String(128), comment="店铺名称")

    # 状态
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否已激活(完成授权)")

    # 授权状态（比 is_active 更精细）
    authorization_status: Mapped[str] = mapped_column(
        String(16), default="pending",
        comment="授权状态(pending/authorized/expired/revoked)"
    )

    # Token 过期管理
    token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime, comment="access_token 过期时间"
    )
    refresh_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime, comment="refresh_token 过期时间"
    )
    last_token_refresh: Mapped[datetime | None] = mapped_column(
        DateTime, comment="上次 token 刷新时间"
    )

    # ISV 关联
    platform_app_id: Mapped[int | None] = mapped_column(
        Integer, comment="关联 ISV 应用ID"
    )

    # 扩展配置
    scopes: Mapped[dict | None] = mapped_column(JSON, comment="授权权限范围")
    webhook_secret: Mapped[str | None] = mapped_column(String(256), comment="Webhook 验签密钥")
    extra_config: Mapped[dict | None] = mapped_column(JSON, comment="平台特有配置")

    # AI 回复配置
    auto_reply_threshold: Mapped[float] = mapped_column(
        Float, default=0.7, comment="自动回复置信度阈值(0-1)"
    )
    human_takeover_message: Mapped[str | None] = mapped_column(
        Text, comment="转人工提示语"
    )

    def __repr__(self) -> str:
        return f"<PlatformConfig {self.platform_type} tenant={self.tenant_id}>"
