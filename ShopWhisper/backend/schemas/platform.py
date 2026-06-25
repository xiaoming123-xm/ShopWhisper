"""
平台对接 Pydantic Schemas
"""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class PinduoduoWebhookPayload(BaseModel):
    """拼多多 Webhook 消息体"""
    shop_id: str | int
    buyer_id: str | int
    conversation_id: str | int
    content: str = ""
    msg_type: int = 1
    extra: dict[str, Any] | None = None


class PlatformConfigCreate(BaseModel):
    """创建/更新平台配置"""
    app_key: str = Field(..., description="平台 App Key")
    app_secret: str = Field(..., description="平台 App Secret")
    auto_reply_threshold: float = Field(0.7, ge=0.0, le=1.0, description="自动回复置信度阈值")
    human_takeover_message: str | None = Field(None, description="转人工提示语")


class PlatformConfigResponse(BaseModel):
    """平台配置响应"""
    id: int
    tenant_id: str
    platform_type: str
    app_key: str
    shop_id: str | None
    shop_name: str | None
    is_active: bool
    authorization_status: str = "pending"
    auto_reply_threshold: float
    human_takeover_message: str | None
    expires_at: datetime | None
    token_expires_at: datetime | None
    refresh_expires_at: datetime | None
    last_token_refresh: datetime | None
    scopes: dict | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# PlatformApp（ISV 应用管理）
# ---------------------------------------------------------------------------

class PlatformAppCreate(BaseModel):
    """创建 ISV 应用"""
    platform_type: str = Field(..., max_length=32, description="平台类型，如 douyin/pinduoduo")
    app_name: str = Field(..., max_length=128, description="应用名称")
    app_key: str = Field(..., max_length=128, description="应用 Key")
    app_secret: str = Field(..., description="应用 Secret（明文，入库时自动加密）")
    callback_url: str | None = Field(None, description="OAuth 回调地址")
    webhook_url: str | None = Field(None, description="Webhook 接收地址")
    scopes: list[str] | None = Field(None, description="申请的权限列表")
    extra_config: dict[str, Any] | None = Field(None, description="平台特有配置")


class PlatformAppUpdate(BaseModel):
    """更新 ISV 应用"""
    app_name: str | None = Field(None, max_length=128, description="应用名称")
    app_key: str | None = Field(None, max_length=128, description="应用 Key")
    app_secret: str | None = Field(None, description="应用 Secret（明文，入库时自动加密）")
    callback_url: str | None = Field(None, description="OAuth 回调地址")
    webhook_url: str | None = Field(None, description="Webhook 接收地址")
    scopes: list[str] | None = Field(None, description="申请的权限列表")
    status: str | None = Field(None, description="状态(active/inactive/reviewing)")
    extra_config: dict[str, Any] | None = Field(None, description="平台特有配置")


class PlatformAppResponse(BaseModel):
    """ISV 应用响应"""
    id: int
    platform_type: str
    app_name: str
    app_key: str
    callback_url: str | None
    webhook_url: str | None
    scopes: dict | None
    status: str
    extra_config: dict | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
