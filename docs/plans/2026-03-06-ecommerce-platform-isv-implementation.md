# 电商平台 ISV 模式对接 - 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在现有项目基础上，构建通用的 ISV 平台对接框架，支持拼多多、抖店、淘宝/天猫、京东、快手五大电商平台的全功能对接（OAuth 授权 + 客服消息 + 商品同步 + 订单同步 + 售后处理）。

**Architecture:** 模块化扩展方案——扩展现有 `BasePlatformAdapter` 为统一接口（OAuth + 消息 + 商品 + 订单 + 售后），创建 `AdapterRegistry` 注册表和 `PlatformGateway` 统一路由分发，用 Celery + RabbitMQ 保障 Webhook 消息可靠性和 Token 自动刷新。新增 `PlatformApp`（ISV 应用管理）、`AfterSaleRecord`（售后记录）、`WebhookEvent`（事件持久化）三个数据模型。

**Tech Stack:** FastAPI + SQLAlchemy (async) + PostgreSQL + Celery + Redis + RabbitMQ + Next.js 14 + Ant Design v6 + TypeScript

**Design Doc:** `docs/plans/2026-03-06-ecommerce-platform-isv-integration-design.md`

---

## 阶段一：基础框架搭建

### Task 1: 新增 DTO 和事件模型

**Files:**
- Create: `backend/services/platform/dto.py`
- Test: `backend/tests/test_platform_dto.py`

**Step 1: 创建 DTO 和事件模型文件**

```python
# backend/services/platform/dto.py
"""平台对接统一 DTO 和事件模型"""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


# ===== 枚举 =====

class PlatformType(str, Enum):
    """支持的电商平台"""
    PINDUODUO = "pinduoduo"
    DOUYIN = "douyin"
    TAOBAO = "taobao"
    JD = "jd"
    KUAISHOU = "kuaishou"


class EventType(str, Enum):
    """平台事件类型"""
    MESSAGE = "message"
    ORDER_STATUS = "order_status"
    AFTERSALE = "aftersale"
    PRODUCT_CHANGE = "product_change"


class AfterSaleType(str, Enum):
    """售后类型"""
    REFUND_ONLY = "refund_only"
    RETURN_REFUND = "return_refund"
    EXCHANGE = "exchange"


class AfterSaleStatus(str, Enum):
    """售后状态"""
    PENDING = "pending"
    PROCESSING = "processing"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AuthorizationStatus(str, Enum):
    """授权状态"""
    PENDING = "pending"
    AUTHORIZED = "authorized"
    EXPIRED = "expired"
    REVOKED = "revoked"


# ===== 已有 DTO（从 base_adapter.py 迁移） =====

@dataclass
class ProductDTO:
    """商品数据传输对象"""
    platform_product_id: str
    title: str
    price: float
    original_price: float | None = None
    description: str | None = None
    category: str | None = None
    images: list[str] = field(default_factory=list)
    videos: list[str] = field(default_factory=list)
    attributes: dict | None = None
    sales_count: int = 0
    stock: int = 0
    status: str = "active"
    platform_data: dict | None = None


@dataclass
class OrderDTO:
    """订单数据传输对象"""
    platform_order_id: str
    product_id: str | None = None
    product_title: str = ""
    buyer_id: str = ""
    quantity: int = 1
    unit_price: float = 0.0
    total_amount: float = 0.0
    status: str = "pending"
    paid_at: datetime | None = None
    shipped_at: datetime | None = None
    completed_at: datetime | None = None
    refund_amount: float | None = None
    platform_data: dict | None = None


@dataclass
class PageResult:
    """分页结果"""
    items: list
    total: int
    page: int
    page_size: int


# ===== 新增 DTO =====

@dataclass
class TokenResult:
    """OAuth Token 换取结果"""
    access_token: str
    refresh_token: str | None = None
    expires_in: int = 7200
    shop_id: str | None = None
    shop_name: str | None = None
    extra: dict = field(default_factory=dict)


@dataclass
class AfterSaleDTO:
    """售后数据传输对象"""
    platform_aftersale_id: str
    order_id: str
    aftersale_type: str = "refund_only"
    status: str = "pending"
    reason: str = ""
    refund_amount: float = 0.0
    buyer_id: str = ""
    platform_data: dict | None = None


# ===== 事件模型 =====

@dataclass
class PlatformEvent:
    """标准化平台事件基类"""
    event_type: str
    platform_type: str
    shop_id: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    raw_data: dict = field(default_factory=dict)
    event_id: str = ""


@dataclass
class MessageEvent(PlatformEvent):
    """消息事件"""
    buyer_id: str = ""
    conversation_id: str = ""
    content: str = ""
    msg_type: str = "text"


@dataclass
class OrderEvent(PlatformEvent):
    """订单状态变更事件"""
    order_id: str = ""
    old_status: str = ""
    new_status: str = ""


@dataclass
class AfterSaleEvent(PlatformEvent):
    """售后事件"""
    aftersale_id: str = ""
    order_id: str = ""
    aftersale_type: str = ""
    status: str = ""
```

**Step 2: 写测试**

```python
# backend/tests/test_platform_dto.py
"""DTO 和事件模型测试"""
from services.platform.dto import (
    PlatformType, EventType, AfterSaleType, AuthorizationStatus,
    ProductDTO, OrderDTO, PageResult, TokenResult, AfterSaleDTO,
    PlatformEvent, MessageEvent, OrderEvent, AfterSaleEvent,
)


def test_platform_type_enum():
    assert PlatformType.PINDUODUO.value == "pinduoduo"
    assert PlatformType.TAOBAO.value == "taobao"
    assert PlatformType.JD.value == "jd"
    assert PlatformType.KUAISHOU.value == "kuaishou"


def test_token_result():
    result = TokenResult(
        access_token="token123",
        refresh_token="refresh456",
        expires_in=3600,
        shop_id="shop1",
    )
    assert result.access_token == "token123"
    assert result.shop_id == "shop1"


def test_aftersale_dto():
    dto = AfterSaleDTO(
        platform_aftersale_id="as001",
        order_id="order001",
        aftersale_type="refund_only",
        refund_amount=99.9,
    )
    assert dto.platform_aftersale_id == "as001"
    assert dto.refund_amount == 99.9


def test_message_event():
    event = MessageEvent(
        event_type=EventType.MESSAGE.value,
        platform_type=PlatformType.PINDUODUO.value,
        shop_id="shop1",
        buyer_id="buyer1",
        conversation_id="conv1",
        content="你好",
    )
    assert event.event_type == "message"
    assert event.buyer_id == "buyer1"


def test_page_result():
    result = PageResult(items=[1, 2, 3], total=10, page=1, page_size=3)
    assert len(result.items) == 3
    assert result.total == 10
```

**Step 3: 运行测试验证通过**

Run: `cd backend && python -m pytest tests/test_platform_dto.py -v`
Expected: All 5 tests PASS

**Step 4: 提交**

```bash
git add backend/services/platform/dto.py backend/tests/test_platform_dto.py
git commit -m "feat: 添加平台对接统一 DTO 和事件模型"
```

---

### Task 2: 新增数据模型 PlatformApp

**Files:**
- Create: `backend/models/platform_app.py`
- Modify: `backend/models/__init__.py`
- Test: `backend/tests/test_platform_app_model.py`

**Step 1: 创建 PlatformApp 模型**

```python
# backend/models/platform_app.py
"""ISV 应用管理模型"""
from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.base import BaseModel


class PlatformApp(BaseModel):
    """ISV 在各电商平台注册的应用信息（全局，非租户级别）"""

    __tablename__ = "platform_apps"
    __table_args__ = {"comment": "ISV 平台应用配置表"}

    # 平台标识（唯一）
    platform_type: Mapped[str] = mapped_column(
        String(32), unique=True, nullable=False, comment="平台类型"
    )

    # 应用信息
    app_name: Mapped[str] = mapped_column(String(128), nullable=False, comment="应用名称")
    app_key: Mapped[str] = mapped_column(String(128), nullable=False, comment="应用 Key")
    app_secret: Mapped[str] = mapped_column(String(512), nullable=False, comment="应用 Secret(加密)")

    # 回调配置
    callback_url: Mapped[str | None] = mapped_column(Text, comment="OAuth 回调地址")
    webhook_url: Mapped[str | None] = mapped_column(Text, comment="Webhook 接收地址")

    # 权限和配置
    scopes: Mapped[dict | None] = mapped_column(JSON, comment="申请的权限列表")
    status: Mapped[str] = mapped_column(
        String(16), default="active", comment="状态(active/inactive/reviewing)"
    )
    extra_config: Mapped[dict | None] = mapped_column(JSON, comment="平台特有配置")

    def __repr__(self) -> str:
        return f"<PlatformApp {self.platform_type} ({self.app_name})>"
```

**Step 2: 在 `models/__init__.py` 注册**

在 `backend/models/__init__.py` 的 import 区域添加：
```python
from models.platform_app import PlatformApp
```
在 `__all__` 列表的 `# Platform` 区域添加：
```python
"PlatformApp",
```

**Step 3: 写测试**

```python
# backend/tests/test_platform_app_model.py
"""PlatformApp 模型导入测试"""
from models.platform_app import PlatformApp


def test_platform_app_tablename():
    assert PlatformApp.__tablename__ == "platform_apps"


def test_platform_app_has_required_columns():
    columns = {c.name for c in PlatformApp.__table__.columns}
    assert "platform_type" in columns
    assert "app_key" in columns
    assert "app_secret" in columns
    assert "callback_url" in columns
    assert "webhook_url" in columns
    assert "scopes" in columns
    assert "status" in columns
    assert "extra_config" in columns


def test_platform_app_repr():
    app = PlatformApp(platform_type="taobao", app_name="测试应用", app_key="k", app_secret="s")
    assert "taobao" in repr(app)
```

**Step 4: 运行测试**

Run: `cd backend && python -m pytest tests/test_platform_app_model.py -v`
Expected: PASS

**Step 5: 提交**

```bash
git add backend/models/platform_app.py backend/models/__init__.py backend/tests/test_platform_app_model.py
git commit -m "feat: 添加 PlatformApp ISV 应用管理模型"
```

---

### Task 3: 新增数据模型 AfterSaleRecord 和 WebhookEvent

**Files:**
- Create: `backend/models/after_sale.py`
- Create: `backend/models/webhook_event.py`
- Modify: `backend/models/__init__.py`

**Step 1: 创建 AfterSaleRecord 模型**

```python
# backend/models/after_sale.py
"""售后记录模型"""
from datetime import datetime

from sqlalchemy import DateTime, Float, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.base import TenantBaseModel


class AfterSaleRecord(TenantBaseModel):
    """售后/退款记录表"""

    __tablename__ = "after_sale_records"
    __table_args__ = (
        Index("idx_aftersale_tenant_config", "tenant_id", "platform_config_id"),
        Index("idx_aftersale_platform_id", "platform_aftersale_id"),
        {"comment": "售后退款记录表"},
    )

    platform_config_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="关联平台配置ID")
    platform_aftersale_id: Mapped[str] = mapped_column(String(128), nullable=False, comment="平台售后单号")
    order_id: Mapped[int | None] = mapped_column(Integer, comment="关联订单ID")

    aftersale_type: Mapped[str] = mapped_column(
        String(32), default="refund_only",
        comment="售后类型(refund_only/return_refund/exchange)"
    )
    status: Mapped[str] = mapped_column(
        String(32), default="pending",
        comment="状态(pending/processing/approved/rejected/completed/cancelled)"
    )
    reason: Mapped[str | None] = mapped_column(Text, comment="售后原因")
    refund_amount: Mapped[float] = mapped_column(Float, default=0.0, comment="退款金额")
    buyer_id: Mapped[str | None] = mapped_column(String(128), comment="买家ID")
    platform_data: Mapped[dict | None] = mapped_column(JSON, comment="平台原始数据")

    def __repr__(self) -> str:
        return f"<AfterSaleRecord {self.platform_aftersale_id} ({self.status})>"
```

**Step 2: 创建 WebhookEvent 模型**

```python
# backend/models/webhook_event.py
"""Webhook 事件记录模型"""
from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.base import TenantBaseModel


class WebhookEvent(TenantBaseModel):
    """Webhook 事件记录（消息可靠性保障）"""

    __tablename__ = "webhook_events"
    __table_args__ = (
        Index("idx_webhook_event_id", "event_id", unique=True),
        Index("idx_webhook_event_status", "status"),
        Index("idx_webhook_event_platform", "platform_type", "platform_config_id"),
        {"comment": "Webhook 事件记录表"},
    )

    event_id: Mapped[str] = mapped_column(String(128), nullable=False, comment="唯一事件ID(幂等键)")
    platform_type: Mapped[str] = mapped_column(String(32), nullable=False, comment="来源平台")
    platform_config_id: Mapped[int | None] = mapped_column(Integer, comment="关联平台配置ID")

    event_type: Mapped[str] = mapped_column(
        String(32), nullable=False,
        comment="事件类型(message/order_status/aftersale/product_change)"
    )
    payload: Mapped[dict | None] = mapped_column(JSON, comment="原始事件数据")

    status: Mapped[str] = mapped_column(
        String(16), default="received",
        comment="处理状态(received/processing/processed/failed)"
    )
    retry_count: Mapped[int] = mapped_column(Integer, default=0, comment="重试次数")
    error_message: Mapped[str | None] = mapped_column(Text, comment="失败原因")
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, comment="处理完成时间")

    def __repr__(self) -> str:
        return f"<WebhookEvent {self.event_id} ({self.status})>"
```

**Step 3: 在 `models/__init__.py` 注册**

添加 import：
```python
from models.after_sale import AfterSaleRecord
from models.webhook_event import WebhookEvent
```
添加到 `__all__`：
```python
"AfterSaleRecord",
"WebhookEvent",
```

**Step 4: 写测试**

```python
# backend/tests/test_new_models.py
"""新增模型测试"""
from models.after_sale import AfterSaleRecord
from models.webhook_event import WebhookEvent


def test_after_sale_record_tablename():
    assert AfterSaleRecord.__tablename__ == "after_sale_records"


def test_after_sale_record_columns():
    columns = {c.name for c in AfterSaleRecord.__table__.columns}
    assert "platform_config_id" in columns
    assert "platform_aftersale_id" in columns
    assert "aftersale_type" in columns
    assert "refund_amount" in columns
    assert "tenant_id" in columns


def test_webhook_event_tablename():
    assert WebhookEvent.__tablename__ == "webhook_events"


def test_webhook_event_columns():
    columns = {c.name for c in WebhookEvent.__table__.columns}
    assert "event_id" in columns
    assert "platform_type" in columns
    assert "event_type" in columns
    assert "payload" in columns
    assert "status" in columns
    assert "retry_count" in columns
```

**Step 5: 运行测试**

Run: `cd backend && python -m pytest tests/test_new_models.py -v`
Expected: PASS

**Step 6: 提交**

```bash
git add backend/models/after_sale.py backend/models/webhook_event.py backend/models/__init__.py backend/tests/test_new_models.py
git commit -m "feat: 添加 AfterSaleRecord 和 WebhookEvent 数据模型"
```

---

### Task 4: 扩展 PlatformConfig 模型

**Files:**
- Modify: `backend/models/platform.py`
- Modify: `backend/schemas/platform.py`

**Step 1: 扩展 PlatformConfig 字段**

在 `backend/models/platform.py` 中，在 `is_active` 字段之后，`auto_reply_threshold` 之前，添加新字段：

```python
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
```

还需要在文件顶部的 import 中添加 `JSON` 和 `Integer`（如果没有的话）。

**Step 2: 更新 Schema**

在 `backend/schemas/platform.py` 中更新 `PlatformConfigResponse`，添加新字段：

```python
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
```

**Step 3: 提交**

```bash
git add backend/models/platform.py backend/schemas/platform.py
git commit -m "feat: 扩展 PlatformConfig 模型字段"
```

---

### Task 5: 扩展 BasePlatformAdapter 接口

**Files:**
- Modify: `backend/services/platform/base_adapter.py`

**Step 1: 重写 base_adapter.py**

将现有 DTO 定义从 `base_adapter.py` 替换为从 `dto.py` 导入，并扩展抽象方法：

```python
# backend/services/platform/base_adapter.py
"""电商平台适配器抽象基类"""
from abc import ABC, abstractmethod
from datetime import datetime

from services.platform.dto import (
    ProductDTO, OrderDTO, PageResult, TokenResult, AfterSaleDTO,
    PlatformEvent,
)


class BasePlatformAdapter(ABC):
    """电商平台适配器抽象基类

    所有电商平台（拼多多、淘宝、京东等）的适配器都继承此类，
    实现统一的 OAuth + 消息 + 商品 + 订单 + 售后 接口。
    """

    def __init__(self, app_key: str, app_secret: str, access_token: str | None = None):
        self.app_key = app_key
        self.app_secret = app_secret
        self.access_token = access_token

    # ===== OAuth 授权 =====

    @abstractmethod
    def get_auth_url(self, state: str, redirect_uri: str) -> str:
        """生成平台 OAuth 授权跳转 URL"""
        ...

    @abstractmethod
    async def exchange_token(self, code: str) -> TokenResult:
        """用授权码换取 access_token"""
        ...

    @abstractmethod
    async def refresh_token(self, refresh_token: str) -> TokenResult:
        """刷新 access_token"""
        ...

    # ===== 消息收发 =====

    @abstractmethod
    def verify_webhook(self, headers: dict, body: bytes) -> bool:
        """验证 Webhook 签名"""
        ...

    @abstractmethod
    def parse_webhook_event(self, body: dict) -> list[PlatformEvent]:
        """解析 Webhook 载荷为标准事件列表"""
        ...

    @abstractmethod
    async def send_message(
        self, conversation_id: str, content: str, msg_type: str = "text"
    ) -> bool:
        """向买家发送消息"""
        ...

    # ===== 商品 =====

    @abstractmethod
    async def fetch_products(self, page: int = 1, page_size: int = 50) -> PageResult:
        """分页拉取商品列表"""
        ...

    @abstractmethod
    async def fetch_product_detail(self, product_id: str) -> ProductDTO:
        """获取商品详情"""
        ...

    @abstractmethod
    async def fetch_updated_products(self, since: datetime) -> list[ProductDTO]:
        """拉取指定时间后变更的商品"""
        ...

    @abstractmethod
    async def upload_image(self, product_id: str, image_url: str) -> str:
        """上传图片到平台，返回平台侧图片URL"""
        ...

    @abstractmethod
    async def upload_video(self, product_id: str, video_url: str) -> str:
        """上传视频到平台，返回平台侧视频URL"""
        ...

    @abstractmethod
    async def update_product(self, product_id: str, data: dict) -> bool:
        """更新商品信息"""
        ...

    # ===== 订单 =====

    @abstractmethod
    async def fetch_orders(
        self,
        page: int = 1,
        page_size: int = 50,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        status: str | None = None,
    ) -> PageResult:
        """分页拉取订单列表"""
        ...

    @abstractmethod
    async def fetch_order_detail(self, order_id: str) -> OrderDTO:
        """获取订单详情"""
        ...

    # ===== 售后 =====

    @abstractmethod
    async def fetch_aftersales(
        self,
        page: int = 1,
        page_size: int = 50,
        status: str | None = None,
    ) -> PageResult:
        """分页拉取售后列表"""
        ...

    @abstractmethod
    async def get_aftersale_detail(self, aftersale_id: str) -> AfterSaleDTO:
        """获取售后详情"""
        ...

    @abstractmethod
    async def approve_refund(self, aftersale_id: str) -> bool:
        """同意退款"""
        ...

    @abstractmethod
    async def reject_refund(self, aftersale_id: str, reason: str) -> bool:
        """拒绝退款"""
        ...
```

**Step 2: 更新 pdd_adapter.py 和 douyin_adapter.py 的 import**

在 `pdd_adapter.py` 和 `douyin_adapter.py` 中，将 DTO import 从 `base_adapter` 改为 `dto`：

```python
# 旧：
from services.platform.base_adapter import BasePlatformAdapter, ProductDTO, OrderDTO, PageResult
# 新：
from services.platform.base_adapter import BasePlatformAdapter
from services.platform.dto import ProductDTO, OrderDTO, PageResult
```

同时，在两个适配器中为新增的抽象方法添加占位实现（先抛 NotImplementedError）：

```python
    # ===== OAuth（占位） =====
    def get_auth_url(self, state: str, redirect_uri: str) -> str:
        raise NotImplementedError("OAuth 在重构后实现")

    async def exchange_token(self, code: str):
        raise NotImplementedError("OAuth 在重构后实现")

    async def refresh_token(self, refresh_token: str):
        raise NotImplementedError("Token 刷新在重构后实现")

    # ===== 消息（占位） =====
    def verify_webhook(self, headers: dict, body: bytes) -> bool:
        raise NotImplementedError("Webhook 验签在重构后实现")

    def parse_webhook_event(self, body: dict) -> list:
        raise NotImplementedError("事件解析在重构后实现")

    async def send_message(self, conversation_id: str, content: str, msg_type: str = "text") -> bool:
        raise NotImplementedError("消息发送在重构后实现")

    # ===== 售后（占位） =====
    async def fetch_aftersales(self, page: int = 1, page_size: int = 50, status: str | None = None):
        raise NotImplementedError("售后拉取在重构后实现")

    async def get_aftersale_detail(self, aftersale_id: str):
        raise NotImplementedError("售后详情在重构后实现")

    async def approve_refund(self, aftersale_id: str) -> bool:
        raise NotImplementedError("同意退款在重构后实现")

    async def reject_refund(self, aftersale_id: str, reason: str) -> bool:
        raise NotImplementedError("拒绝退款在重构后实现")
```

**Step 3: 运行现有测试确认不破坏**

Run: `cd backend && python -m pytest tests/ -v --tb=short 2>&1 | head -50`
Expected: 现有测试仍通过

**Step 4: 提交**

```bash
git add backend/services/platform/base_adapter.py backend/services/platform/pdd_adapter.py backend/services/platform/douyin_adapter.py
git commit -m "feat: 扩展 BasePlatformAdapter 接口（OAuth+消息+售后）"
```

---

### Task 6: 创建 AdapterRegistry

**Files:**
- Create: `backend/services/platform/adapter_registry.py`
- Modify: `backend/services/platform/adapter_factory.py`
- Test: `backend/tests/test_adapter_registry.py`

**Step 1: 创建注册表**

```python
# backend/services/platform/adapter_registry.py
"""平台适配器注册表"""
import logging
from typing import Type

from core.crypto import decrypt_field
from models.platform import PlatformConfig
from models.platform_app import PlatformApp
from services.platform.base_adapter import BasePlatformAdapter

logger = logging.getLogger(__name__)

# 适配器注册表
_adapters: dict[str, Type[BasePlatformAdapter]] = {}


def register(platform_type: str):
    """装饰器：注册平台适配器类

    Usage:
        @register("taobao")
        class TaobaoAdapter(BasePlatformAdapter):
            ...
    """
    def decorator(cls: Type[BasePlatformAdapter]):
        _adapters[platform_type] = cls
        logger.info("注册平台适配器: %s -> %s", platform_type, cls.__name__)
        return cls
    return decorator


def create_adapter(
    config: PlatformConfig,
    app: PlatformApp | None = None,
) -> BasePlatformAdapter:
    """根据平台配置创建适配器实例

    Args:
        config: 商家级别的平台配置（含 access_token 等）
        app: ISV 应用配置（含 app_key/app_secret）。如果为 None，
             则从 config 中取 app_key/app_secret（兼容旧逻辑）。
    """
    adapter_cls = _adapters.get(config.platform_type)
    if not adapter_cls:
        raise ValueError(f"不支持的平台类型: {config.platform_type}")

    # 确定 app_key 和 app_secret 的来源
    if app:
        app_key = app.app_key
        try:
            app_secret = decrypt_field(app.app_secret)
        except Exception:
            app_secret = app.app_secret
    else:
        app_key = config.app_key
        try:
            app_secret = decrypt_field(config.app_secret)
        except Exception:
            app_secret = config.app_secret

    return adapter_cls(
        app_key=app_key,
        app_secret=app_secret,
        access_token=config.access_token,
    )


def get_supported_platforms() -> list[str]:
    """获取所有已注册的平台类型"""
    return list(_adapters.keys())
```

**Step 2: 在现有适配器上添加注册装饰器**

在 `pdd_adapter.py` 文件顶部添加 import 并加装饰器：
```python
from services.platform.adapter_registry import register

@register("pinduoduo")
class PddAdapter(BasePlatformAdapter):
    ...
```

在 `douyin_adapter.py` 同样处理：
```python
from services.platform.adapter_registry import register

@register("douyin")
class DouyinAdapter(BasePlatformAdapter):
    ...
```

**Step 3: 更新 adapter_factory.py 为兼容桥接**

```python
# backend/services/platform/adapter_factory.py
"""平台适配器工厂（桥接到 adapter_registry）"""
from models.platform import PlatformConfig
from services.platform.base_adapter import BasePlatformAdapter
from services.platform.adapter_registry import create_adapter as _create

# 确保适配器被导入和注册
import services.platform.pdd_adapter  # noqa: F401
import services.platform.douyin_adapter  # noqa: F401


def create_adapter(config: PlatformConfig) -> BasePlatformAdapter:
    """兼容旧调用方式的工厂函数"""
    return _create(config)
```

**Step 4: 写测试**

```python
# backend/tests/test_adapter_registry.py
"""适配器注册表测试"""
from services.platform.adapter_registry import _adapters, get_supported_platforms

# 确保适配器被导入注册
import services.platform.pdd_adapter  # noqa: F401
import services.platform.douyin_adapter  # noqa: F401


def test_adapters_registered():
    assert "pinduoduo" in _adapters
    assert "douyin" in _adapters


def test_get_supported_platforms():
    platforms = get_supported_platforms()
    assert "pinduoduo" in platforms
    assert "douyin" in platforms
```

**Step 5: 运行测试**

Run: `cd backend && python -m pytest tests/test_adapter_registry.py -v`
Expected: PASS

**Step 6: 提交**

```bash
git add backend/services/platform/adapter_registry.py backend/services/platform/adapter_factory.py backend/services/platform/pdd_adapter.py backend/services/platform/douyin_adapter.py backend/tests/test_adapter_registry.py
git commit -m "feat: 添加 AdapterRegistry 适配器注册表"
```

---

### Task 7: 创建 PlatformGateway 统一路由

**Files:**
- Create: `backend/api/routers/platform_gateway.py`
- Modify: `backend/api/main.py`

**Step 1: 创建统一路由**

```python
# backend/api/routers/platform_gateway.py
"""平台对接统一网关路由

将所有平台的 OAuth / Webhook / Reply 统一为参数化路由：
  /platform/{platform_type}/auth
  /platform/{platform_type}/callback
  /platform/{platform_type}/webhook
  /platform/{platform_type}/reply
"""
import logging
import urllib.parse
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import and_, select

from api.dependencies import DBDep, TenantTokenDep
from core.crypto import decrypt_field, encrypt_field
from models.platform import PlatformConfig
from models.platform_app import PlatformApp
from models.webhook_event import WebhookEvent
from schemas.platform import PlatformConfigCreate, PlatformConfigResponse
from services.platform.adapter_registry import create_adapter, get_supported_platforms

# 确保所有适配器被注册
import services.platform.pdd_adapter  # noqa: F401
import services.platform.douyin_adapter  # noqa: F401

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/platform", tags=["平台对接"])


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------

async def _get_platform_app(db, platform_type: str) -> PlatformApp:
    """获取 ISV 应用配置"""
    stmt = select(PlatformApp).where(
        and_(
            PlatformApp.platform_type == platform_type,
            PlatformApp.status == "active",
        )
    )
    result = await db.execute(stmt)
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail=f"未配置 {platform_type} ISV 应用")
    return app


async def _get_config_by_id(db, config_id: int, tenant_id: str) -> PlatformConfig:
    """根据 ID 获取平台配置"""
    stmt = select(PlatformConfig).where(
        and_(
            PlatformConfig.id == config_id,
            PlatformConfig.tenant_id == tenant_id,
        )
    )
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    return config


async def _find_config_by_shop(db, platform_type: str, shop_id: str) -> PlatformConfig | None:
    """根据 shop_id 查找配置"""
    stmt = select(PlatformConfig).where(
        and_(
            PlatformConfig.platform_type == platform_type,
            PlatformConfig.shop_id == shop_id,
            PlatformConfig.is_active == True,
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Webhook（无需认证）
# ---------------------------------------------------------------------------

@router.post("/{platform_type}/webhook", summary="统一 Webhook 接收", include_in_schema=False)
async def unified_webhook(
    platform_type: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: DBDep,
):
    """统一接收各平台 Webhook 推送

    流程：
    1. 获取 ISV 应用配置
    2. 创建适配器验证签名
    3. 解析事件
    4. 持久化到 webhook_events 表
    5. 异步分发处理
    """
    if platform_type not in get_supported_platforms():
        raise HTTPException(status_code=400, detail=f"不支持的平台: {platform_type}")

    body = await request.body()
    try:
        payload_data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="无效的请求体")

    # 获取 ISV 应用
    app = await _get_platform_app(db, platform_type)

    # 创建适配器用于验签和事件解析
    # 对于 webhook，我们需要一个临时的 config 对象用于签名验证
    # 实际验签使用 app 级别的 secret
    try:
        app_secret = decrypt_field(app.app_secret)
    except Exception:
        app_secret = app.app_secret

    from services.platform.adapter_registry import _adapters
    adapter_cls = _adapters.get(platform_type)
    if not adapter_cls:
        raise HTTPException(status_code=400, detail=f"不支持的平台: {platform_type}")

    adapter = adapter_cls(
        app_key=app.app_key,
        app_secret=app_secret,
        access_token=None,
    )

    # 验签
    headers_dict = dict(request.headers)
    if not adapter.verify_webhook(headers_dict, body):
        raise HTTPException(status_code=401, detail="Webhook 签名验证失败")

    # 解析事件
    events = adapter.parse_webhook_event(payload_data)

    # 持久化事件并异步处理
    for event in events:
        event_id = event.event_id or str(uuid.uuid4())

        # 幂等检查
        existing = await db.execute(
            select(WebhookEvent).where(WebhookEvent.event_id == event_id)
        )
        if existing.scalar_one_or_none():
            continue

        # 查找对应的商家配置
        config = await _find_config_by_shop(db, platform_type, event.shop_id)

        webhook_event = WebhookEvent(
            tenant_id=config.tenant_id if config else "unknown",
            event_id=event_id,
            platform_type=platform_type,
            platform_config_id=config.id if config else None,
            event_type=event.event_type,
            payload=event.raw_data,
            status="received",
        )
        db.add(webhook_event)

    await db.commit()

    # 异步处理（兼容现有的 PlatformMessageService）
    from services.platform.platform_message_service import PlatformMessageService
    service = PlatformMessageService(db)
    if platform_type == "pinduoduo":
        background_tasks.add_task(service.handle_pinduoduo_webhook, payload_data)
    elif platform_type == "douyin":
        background_tasks.add_task(service.handle_douyin_webhook, payload_data)
    # 新平台的处理在后续 Task 中添加

    # 快速响应
    if platform_type == "douyin":
        return {"code": 0, "msg": "success"}
    return {"success": True}


# ---------------------------------------------------------------------------
# OAuth 授权（JWT 认证）
# ---------------------------------------------------------------------------

@router.get("/{platform_type}/auth", summary="跳转平台 OAuth 授权")
async def oauth_redirect(
    platform_type: str,
    tenant_id: TenantTokenDep,
    db: DBDep,
    redirect_uri: str,
    config_id: int | None = None,
):
    """通用 OAuth 授权跳转

    如果 config_id 存在，使用已有配置；否则自动创建新配置。
    """
    if platform_type not in get_supported_platforms():
        raise HTTPException(status_code=400, detail=f"不支持的平台: {platform_type}")

    app = await _get_platform_app(db, platform_type)

    if config_id:
        config = await _get_config_by_id(db, config_id, tenant_id)
    else:
        # 自动创建平台配置
        config = PlatformConfig(
            tenant_id=tenant_id,
            platform_type=platform_type,
            app_key=app.app_key,
            app_secret=app.app_secret,
            platform_app_id=app.id,
            is_active=False,
            authorization_status="pending",
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)

    # 使用适配器生成授权 URL
    adapter = create_adapter(config, app)
    state = f"{tenant_id}:{config.id}"
    auth_url = adapter.get_auth_url(state=state, redirect_uri=redirect_uri)

    return RedirectResponse(url=auth_url)


@router.get("/{platform_type}/callback", summary="OAuth 回调", include_in_schema=False)
async def oauth_callback(
    platform_type: str,
    code: str,
    state: str,
    db: DBDep,
):
    """通用 OAuth 回调处理"""
    parts = state.split(":")
    if len(parts) != 2:
        return RedirectResponse(url="/settings?menu=platform&status=error&msg=invalid_state")

    tenant_id, config_id = parts[0], int(parts[1])

    stmt = select(PlatformConfig).where(
        and_(
            PlatformConfig.id == config_id,
            PlatformConfig.tenant_id == tenant_id,
        )
    )
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()
    if not config:
        return RedirectResponse(url="/settings?menu=platform&status=error&msg=no_config")

    # 获取 ISV 应用
    app = await _get_platform_app(db, platform_type)
    adapter = create_adapter(config, app)

    try:
        token_result = await adapter.exchange_token(code)
    except Exception as e:
        logger.error("换取 access_token 失败: %s", e)
        return RedirectResponse(url="/settings?menu=platform&status=error&msg=token_failed")

    # 更新配置
    config.access_token = token_result.access_token
    config.refresh_token = token_result.refresh_token
    config.expires_at = datetime.utcnow() + timedelta(seconds=token_result.expires_in)
    config.token_expires_at = config.expires_at
    config.shop_id = token_result.shop_id or config.shop_id
    if token_result.shop_name:
        config.shop_name = token_result.shop_name
    config.is_active = True
    config.authorization_status = "authorized"
    config.last_token_refresh = datetime.utcnow()

    await db.commit()

    return RedirectResponse(url="/settings?menu=platform&status=success")


# ---------------------------------------------------------------------------
# 平台配置 CRUD（JWT 认证）
# ---------------------------------------------------------------------------

@router.get("/configs", summary="获取所有平台配置", response_model=list[PlatformConfigResponse])
async def get_platform_configs(
    tenant_id: TenantTokenDep,
    db: DBDep,
):
    """获取当前租户的所有平台配置"""
    stmt = select(PlatformConfig).where(PlatformConfig.tenant_id == tenant_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/apps", summary="获取可用的 ISV 应用列表")
async def get_platform_apps(
    tenant_id: TenantTokenDep,
    db: DBDep,
):
    """获取所有已配置的 ISV 应用"""
    stmt = select(PlatformApp).where(PlatformApp.status == "active")
    result = await db.execute(stmt)
    apps = result.scalars().all()
    return [
        {
            "platform_type": a.platform_type,
            "app_name": a.app_name,
            "status": a.status,
        }
        for a in apps
    ]


@router.delete("/configs/{config_id}", summary="断开平台连接")
async def disconnect_platform(
    tenant_id: TenantTokenDep,
    db: DBDep,
    config_id: int,
):
    """断开平台授权"""
    config = await _get_config_by_id(db, config_id, tenant_id)
    config.access_token = None
    config.refresh_token = None
    config.expires_at = None
    config.is_active = False
    config.authorization_status = "revoked"
    await db.commit()
    return {"success": True, "message": f"已断开 {config.platform_type} 连接"}


# ---------------------------------------------------------------------------
# 人工回复（JWT 认证）
# ---------------------------------------------------------------------------

class ManualReplyRequest(BaseModel):
    conversation_id: str
    content: str


@router.post("/{platform_type}/reply", summary="人工回复消息")
async def manual_reply(
    platform_type: str,
    tenant_id: TenantTokenDep,
    db: DBDep,
    body: ManualReplyRequest,
):
    """通用人工回复"""
    from models import Conversation, Message

    # 查找会话
    stmt = select(Conversation).where(
        and_(
            Conversation.tenant_id == tenant_id,
            Conversation.conversation_id == body.conversation_id,
            Conversation.platform_type == platform_type,
        )
    )
    result = await db.execute(stmt)
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="会话不存在")

    # 查找平台配置
    stmt2 = select(PlatformConfig).where(
        and_(
            PlatformConfig.tenant_id == tenant_id,
            PlatformConfig.platform_type == platform_type,
            PlatformConfig.is_active == True,
        )
    )
    result2 = await db.execute(stmt2)
    config = result2.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=400, detail="平台未连接")

    app = await _get_platform_app(db, platform_type)
    adapter = create_adapter(config, app)

    try:
        await adapter.send_message(
            conversation_id=conversation.platform_conversation_id,
            content=body.content,
        )
    except Exception as e:
        logger.error("人工回复发送失败: %s", e)
        raise HTTPException(status_code=502, detail="消息发送失败")

    # 保存消息记录
    msg = Message(
        tenant_id=tenant_id,
        message_id=f"msg_{int(datetime.utcnow().timestamp())}_{platform_type}_human",
        conversation_id=body.conversation_id,
        role="assistant",
        content=body.content,
    )
    db.add(msg)
    await db.commit()

    return {"success": True}
```

**Step 2: 在 main.py 注册新路由**

在 `backend/api/main.py` 的 import 区域添加：
```python
from api.routers import platform_gateway,
```

在路由注册区域添加：
```python
app.include_router(platform_gateway.router, prefix=settings.api_v1_prefix)
```

注意：保留现有的 `platform.router` 注册，确保向后兼容。新路由路径不与旧的冲突（新的用 `/platform/{platform_type}/webhook`，旧的用 `/platform/pinduoduo/webhook`，需要确认路由优先级。实际上应在完成 Task 8 适配器重构后再移除旧路由）。

**Step 3: 提交**

```bash
git add backend/api/routers/platform_gateway.py backend/api/main.py
git commit -m "feat: 添加 PlatformGateway 统一路由"
```

---

### Task 8: 重构拼多多适配器到新框架

**Files:**
- Modify: `backend/services/platform/pdd_adapter.py`
- Modify: `backend/services/platform/pinduoduo_client.py`

**Step 1: 在 PddAdapter 中实现新接口方法**

替换 PddAdapter 中的占位方法为实际实现。OAuth 和消息方法委托给已有的 `PinduoduoClient`：

```python
# 在 PddAdapter 类中实现：

    PDD_AUTH_URL = "https://mms.pinduoduo.com/open.html"

    def get_auth_url(self, state: str, redirect_uri: str) -> str:
        import urllib.parse
        params = {
            "response_type": "code",
            "client_id": self.app_key,
            "redirect_uri": redirect_uri,
            "state": state,
        }
        return f"{self.PDD_AUTH_URL}?{urllib.parse.urlencode(params)}"

    async def exchange_token(self, code: str) -> TokenResult:
        from services.platform.dto import TokenResult
        client = PinduoduoClient(self.app_key, self.app_secret)
        token_data = await client.call_api(
            method="pdd.pop.auth.token.create",
            params={"code": code, "grant_type": "authorization_code"},
        )
        return TokenResult(
            access_token=token_data.get("access_token", ""),
            refresh_token=token_data.get("refresh_token"),
            expires_in=token_data.get("expires_in", 7776000),
            shop_id=str(token_data.get("owner_id", "")),
        )

    async def refresh_token(self, refresh_token: str) -> TokenResult:
        from services.platform.dto import TokenResult
        client = PinduoduoClient(self.app_key, self.app_secret)
        token_data = await client.refresh_access_token(refresh_token)
        return TokenResult(
            access_token=token_data.get("access_token", ""),
            refresh_token=token_data.get("refresh_token"),
            expires_in=token_data.get("expires_in", 7776000),
        )

    def verify_webhook(self, headers: dict, body: bytes) -> bool:
        signature = headers.get("pdd-sign", "")
        if not signature:
            return True  # 无签名则不验证（兼容测试）
        client = PinduoduoClient(self.app_key, self.app_secret)
        return client.verify_webhook_signature(body, signature)

    def parse_webhook_event(self, body: dict) -> list:
        from services.platform.dto import MessageEvent, EventType, PlatformType
        import json
        events = []
        # 拼多多 webhook 通常是单条消息
        shop_id = str(body.get("shop_id", ""))
        buyer_id = str(body.get("buyer_id", ""))
        conversation_id = str(body.get("conversation_id", ""))
        content = body.get("content", "")
        msg_type = body.get("msg_type", 1)

        if content or conversation_id:
            events.append(MessageEvent(
                event_type=EventType.MESSAGE.value,
                platform_type=PlatformType.PINDUODUO.value,
                shop_id=shop_id,
                buyer_id=buyer_id,
                conversation_id=conversation_id,
                content=content,
                msg_type="text" if msg_type == 1 else str(msg_type),
                raw_data=body,
                event_id=f"pdd_{shop_id}_{conversation_id}_{int(datetime.utcnow().timestamp())}",
            ))
        return events

    async def send_message(self, conversation_id: str, content: str, msg_type: str = "text") -> bool:
        client = PinduoduoClient(self.app_key, self.app_secret)
        await client.send_message(
            access_token=self.access_token,
            conversation_id=conversation_id,
            content=content,
        )
        return True

    # 售后方法
    async def fetch_aftersales(self, page=1, page_size=50, status=None):
        from services.platform.dto import PageResult, AfterSaleDTO
        client = PinduoduoClient(self.app_key, self.app_secret)
        params = {"page": page, "page_size": page_size}
        if status:
            params["after_sales_status"] = status
        try:
            data = await client.call_api(
                method="pdd.refund.list.increment.get",
                params=params,
                access_token=self.access_token,
            )
            items = []
            for item in data.get("refund_list", []):
                items.append(AfterSaleDTO(
                    platform_aftersale_id=str(item.get("id", "")),
                    order_id=str(item.get("order_sn", "")),
                    aftersale_type="refund_only" if item.get("after_sales_type") == 1 else "return_refund",
                    status=str(item.get("after_sales_status", "pending")),
                    reason=item.get("reason", ""),
                    refund_amount=item.get("refund_amount", 0) / 100,
                    buyer_id="",
                    platform_data=item,
                ))
            return PageResult(items=items, total=data.get("total_count", 0), page=page, page_size=page_size)
        except Exception:
            return PageResult(items=[], total=0, page=page, page_size=page_size)

    async def get_aftersale_detail(self, aftersale_id: str):
        from services.platform.dto import AfterSaleDTO
        client = PinduoduoClient(self.app_key, self.app_secret)
        data = await client.call_api(
            method="pdd.refund.information.get",
            params={"after_sales_id": aftersale_id},
            access_token=self.access_token,
        )
        return AfterSaleDTO(
            platform_aftersale_id=aftersale_id,
            order_id=str(data.get("order_sn", "")),
            status=str(data.get("after_sales_status", "")),
            reason=data.get("reason", ""),
            refund_amount=data.get("refund_amount", 0) / 100,
            platform_data=data,
        )

    async def approve_refund(self, aftersale_id: str) -> bool:
        client = PinduoduoClient(self.app_key, self.app_secret)
        await client.call_api(
            method="pdd.refund.agree",
            params={"after_sales_id": aftersale_id},
            access_token=self.access_token,
        )
        return True

    async def reject_refund(self, aftersale_id: str, reason: str) -> bool:
        client = PinduoduoClient(self.app_key, self.app_secret)
        await client.call_api(
            method="pdd.refund.refuse",
            params={"after_sales_id": aftersale_id, "refuse_reason": reason},
            access_token=self.access_token,
        )
        return True
```

**Step 2: 运行测试确认不破坏**

Run: `cd backend && python -m pytest tests/ -v --tb=short 2>&1 | head -50`

**Step 3: 提交**

```bash
git add backend/services/platform/pdd_adapter.py
git commit -m "refactor: 拼多多适配器实现完整接口（OAuth+消息+售后）"
```

---

### Task 9: 重构抖店适配器到新框架

**Files:**
- Modify: `backend/services/platform/douyin_adapter.py`

**Step 1: 在 DouyinAdapter 中实现新接口方法**

类似 Task 8，在 DouyinAdapter 中实现 OAuth、消息、售后方法，委托给 `DouyinClient`。

关键差异：
- OAuth URL: `https://open.douyin.com/platform/oauth/connect`
- exchange_token 使用 `client.create_access_token()`
- verify_webhook 需要从 headers 中取 `event-sign`、`app-id`、`sign-method`
- parse_webhook_event 需要兼容旧格式和官方 `[{tag, msg_id, data}]` 格式
- 售后 API 方法名不同

**Step 2: 提交**

```bash
git add backend/services/platform/douyin_adapter.py
git commit -m "refactor: 抖店适配器实现完整接口（OAuth+消息+售后）"
```

---

## 阶段二：可靠性 + Token 管理

### Task 10: Token 自动刷新任务重构

**Files:**
- Modify: `backend/tasks/platform_tasks.py`
- Modify: `backend/tasks/celery_app.py`

**Step 1: 重构 platform_tasks.py 使用 AdapterRegistry**

```python
# backend/tasks/platform_tasks.py
"""平台对接定时任务"""
import logging
from datetime import datetime, timedelta

from tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.platform_tasks.refresh_expiring_tokens")
def refresh_expiring_tokens():
    """刷新即将过期的平台 access_token"""
    import asyncio
    asyncio.run(_refresh_expiring_tokens())


async def _refresh_expiring_tokens():
    from sqlalchemy import and_, select
    from db.session import get_async_session
    from models.platform import PlatformConfig
    from models.platform_app import PlatformApp
    from services.platform.adapter_registry import create_adapter

    # 确保适配器注册
    import services.platform.pdd_adapter  # noqa: F401
    import services.platform.douyin_adapter  # noqa: F401

    threshold = datetime.utcnow() + timedelta(hours=2)

    async with get_async_session() as db:
        stmt = select(PlatformConfig).where(
            and_(
                PlatformConfig.is_active == True,
                PlatformConfig.refresh_token.isnot(None),
                PlatformConfig.expires_at <= threshold,
            )
        )
        result = await db.execute(stmt)
        configs = result.scalars().all()

        for config in configs:
            try:
                # 尝试获取 ISV 应用配置
                app_stmt = select(PlatformApp).where(
                    PlatformApp.platform_type == config.platform_type
                )
                app_result = await db.execute(app_stmt)
                app = app_result.scalar_one_or_none()

                adapter = create_adapter(config, app)
                token_result = await adapter.refresh_token(config.refresh_token)

                config.access_token = token_result.access_token
                config.refresh_token = token_result.refresh_token or config.refresh_token
                config.expires_at = datetime.utcnow() + timedelta(seconds=token_result.expires_in)
                config.token_expires_at = config.expires_at
                config.last_token_refresh = datetime.utcnow()
                config.authorization_status = "authorized"

                await db.commit()
                logger.info(
                    "已刷新 tenant=%s platform=%s 的 access_token",
                    config.tenant_id, config.platform_type,
                )
            except Exception as e:
                logger.error("刷新 token 失败 tenant=%s: %s", config.tenant_id, e)
                # 如果 refresh_token 也过期，标记授权过期
                if "expired" in str(e).lower() or "invalid" in str(e).lower():
                    config.authorization_status = "expired"
                    config.is_active = False
                    await db.commit()
                    logger.warning(
                        "tenant=%s platform=%s 的授权已过期，需要重新授权",
                        config.tenant_id, config.platform_type,
                    )
```

**Step 2: 更新 Celery Beat 频率**

在 `celery_app.py` 中，将 `refresh-platform-tokens` 的 schedule 从 3600.0（1小时）改为 1800.0（30分钟）：

```python
    "refresh-platform-tokens": {
        "task": "tasks.platform_tasks.refresh_expiring_tokens",
        "schedule": 1800.0,  # 每30分钟检查一次
    },
```

**Step 3: 提交**

```bash
git add backend/tasks/platform_tasks.py backend/tasks/celery_app.py
git commit -m "refactor: Token 刷新任务使用 AdapterRegistry"
```

---

### Task 11: API 速率限制器

**Files:**
- Create: `backend/services/platform/rate_limiter.py`
- Test: `backend/tests/test_rate_limiter.py`

**Step 1: 创建速率限制器**

```python
# backend/services/platform/rate_limiter.py
"""平台 API 速率限制器（基于 Redis 令牌桶）"""
import logging
import asyncio
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
```

**Step 2: 写测试**

```python
# backend/tests/test_rate_limiter.py
"""速率限制器测试"""
from services.platform.rate_limiter import PLATFORM_LIMITS, RateLimiter


def test_platform_limits_defined():
    assert "pinduoduo" in PLATFORM_LIMITS
    assert "douyin" in PLATFORM_LIMITS
    assert "taobao" in PLATFORM_LIMITS
    assert "jd" in PLATFORM_LIMITS
    assert "kuaishou" in PLATFORM_LIMITS


def test_platform_limits_structure():
    for platform, limits in PLATFORM_LIMITS.items():
        assert "calls_per_second" in limits
        assert "calls_per_minute" in limits
        assert limits["calls_per_second"] > 0
        assert limits["calls_per_minute"] > 0
```

**Step 3: 运行测试**

Run: `cd backend && python -m pytest tests/test_rate_limiter.py -v`
Expected: PASS

**Step 4: 提交**

```bash
git add backend/services/platform/rate_limiter.py backend/tests/test_rate_limiter.py
git commit -m "feat: 添加平台 API 速率限制器"
```

---

## 阶段三：新平台适配器

### Task 12: 淘宝/天猫适配器

**Files:**
- Create: `backend/services/platform/taobao/__init__.py`
- Create: `backend/services/platform/taobao/client.py`
- Create: `backend/services/platform/taobao/adapter.py`

**Step 1: 创建淘宝 API 客户端**

```python
# backend/services/platform/taobao/client.py
"""淘宝 TOP API 客户端"""
import hashlib
import hmac
import json
import logging
import time
from datetime import datetime

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

TOP_API_URL = "https://eco.taobao.com/router/rest"


class TaobaoClient:
    """淘宝 TOP (Taobao Open Platform) API 客户端"""

    def __init__(self, app_key: str, app_secret: str):
        self.app_key = app_key
        self.app_secret = app_secret

    def sign_request(self, params: dict) -> str:
        """HMAC-MD5 签名

        签名算法：
        1. 参数按 key 字典序排列
        2. 拼接为 key1value1key2value2...
        3. 前后加 app_secret
        4. MD5 取大写 hex
        """
        sorted_params = sorted(params.items())
        sign_str = self.app_secret
        for k, v in sorted_params:
            if v is not None:
                sign_str += f"{k}{v}"
        sign_str += self.app_secret
        return hashlib.md5(sign_str.encode("utf-8")).hexdigest().upper()

    async def call_api(
        self, method: str, params: dict | None = None, session_key: str | None = None
    ) -> dict:
        """调用淘宝 TOP API"""
        sys_params = {
            "app_key": self.app_key,
            "method": method,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "format": "json",
            "v": "2.0",
            "sign_method": "md5",
        }
        if session_key:
            sys_params["session"] = session_key
        if params:
            sys_params.update(params)

        sys_params["sign"] = self.sign_request(sys_params)

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(TOP_API_URL, data=sys_params)
            resp.raise_for_status()
            data = resp.json()

        # 淘宝 API 错误处理
        if "error_response" in data:
            err = data["error_response"]
            raise Exception(f"淘宝 API 错误: {err.get('code')} - {err.get('msg')}")

        # 响应格式: {"method_response": {...}}
        response_key = method.replace(".", "_") + "_response"
        return data.get(response_key, data)

    async def get_access_token(self, code: str) -> dict:
        """用授权码换取 access_token"""
        url = "https://oauth.taobao.com/token"
        params = {
            "grant_type": "authorization_code",
            "client_id": self.app_key,
            "client_secret": self.app_secret,
            "code": code,
            "redirect_uri": "",  # 需要与授权时一致
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, data=params)
            resp.raise_for_status()
            return resp.json()

    async def refresh_access_token(self, refresh_token: str) -> dict:
        """刷新 access_token"""
        url = "https://oauth.taobao.com/token"
        params = {
            "grant_type": "refresh_token",
            "client_id": self.app_key,
            "client_secret": self.app_secret,
            "refresh_token": refresh_token,
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, data=params)
            resp.raise_for_status()
            return resp.json()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def send_message(self, session_key: str, buyer_nick: str, content: str) -> dict:
        """发送客服消息"""
        return await self.call_api(
            method="taobao.miniapp.message.send",
            params={
                "target_user_nick": buyer_nick,
                "msg_type": "text",
                "content": json.dumps({"text": content}),
            },
            session_key=session_key,
        )

    def verify_webhook_signature(self, body: bytes, signature: str) -> bool:
        """验证淘宝消息推送签名"""
        expected = hmac.new(
            self.app_secret.encode("utf-8"),
            body,
            hashlib.md5,
        ).hexdigest().upper()
        return hmac.compare_digest(expected, signature.upper())
```

**Step 2: 创建淘宝适配器**

```python
# backend/services/platform/taobao/adapter.py
"""淘宝/天猫平台适配器"""
import logging
from datetime import datetime

from services.platform.adapter_registry import register
from services.platform.base_adapter import BasePlatformAdapter
from services.platform.dto import (
    ProductDTO, OrderDTO, AfterSaleDTO, PageResult, TokenResult,
    PlatformEvent, MessageEvent, EventType, PlatformType,
)
from services.platform.taobao.client import TaobaoClient

logger = logging.getLogger(__name__)

TAOBAO_AUTH_URL = "https://oauth.taobao.com/authorize"


@register("taobao")
class TaobaoAdapter(BasePlatformAdapter):
    """淘宝/天猫平台适配器"""

    def get_auth_url(self, state: str, redirect_uri: str) -> str:
        import urllib.parse
        params = {
            "response_type": "code",
            "client_id": self.app_key,
            "redirect_uri": redirect_uri,
            "state": state,
            "view": "web",
        }
        return f"{TAOBAO_AUTH_URL}?{urllib.parse.urlencode(params)}"

    async def exchange_token(self, code: str) -> TokenResult:
        client = TaobaoClient(self.app_key, self.app_secret)
        data = await client.get_access_token(code)
        return TokenResult(
            access_token=data.get("access_token", ""),
            refresh_token=data.get("refresh_token"),
            expires_in=int(data.get("expires_in", 86400)),
            shop_id=str(data.get("taobao_user_id", "")),
            shop_name=data.get("taobao_user_nick"),
        )

    async def refresh_token(self, refresh_token: str) -> TokenResult:
        client = TaobaoClient(self.app_key, self.app_secret)
        data = await client.refresh_access_token(refresh_token)
        return TokenResult(
            access_token=data.get("access_token", ""),
            refresh_token=data.get("refresh_token"),
            expires_in=int(data.get("expires_in", 86400)),
        )

    def verify_webhook(self, headers: dict, body: bytes) -> bool:
        signature = headers.get("sign", "") or headers.get("x-sign", "")
        if not signature:
            return True
        client = TaobaoClient(self.app_key, self.app_secret)
        return client.verify_webhook_signature(body, signature)

    def parse_webhook_event(self, body: dict) -> list[PlatformEvent]:
        events = []
        # 淘宝消息通道 (TMC) 格式
        messages = body.get("messages", [body]) if isinstance(body, dict) else [body]
        for msg in messages:
            topic = msg.get("topic", "")
            if "trade" in topic or "refund" in topic:
                # 订单/售后事件 - 后续处理
                pass
            else:
                # 默认当作消息事件
                content_data = msg.get("content", {})
                if isinstance(content_data, str):
                    import json
                    try:
                        content_data = json.loads(content_data)
                    except Exception:
                        content_data = {"text": content_data}

                events.append(MessageEvent(
                    event_type=EventType.MESSAGE.value,
                    platform_type=PlatformType.TAOBAO.value,
                    shop_id=str(msg.get("user_id", "")),
                    buyer_id=str(content_data.get("buyer_nick", "")),
                    conversation_id=str(content_data.get("session_id", "")),
                    content=content_data.get("text", ""),
                    msg_type="text",
                    raw_data=msg,
                    event_id=str(msg.get("id", "")),
                ))
        return events

    async def send_message(self, conversation_id: str, content: str, msg_type: str = "text") -> bool:
        client = TaobaoClient(self.app_key, self.app_secret)
        await client.send_message(
            session_key=self.access_token,
            buyer_nick=conversation_id,
            content=content,
        )
        return True

    # ===== 商品 =====
    async def fetch_products(self, page=1, page_size=50) -> PageResult:
        client = TaobaoClient(self.app_key, self.app_secret)
        data = await client.call_api(
            method="taobao.items.onsale.get",
            params={"page_no": page, "page_size": page_size, "fields": "num_iid,title,price,pic_url,num,list_time"},
            session_key=self.access_token,
        )
        items = []
        for item in data.get("items", {}).get("item", []):
            items.append(ProductDTO(
                platform_product_id=str(item.get("num_iid", "")),
                title=item.get("title", ""),
                price=float(item.get("price", 0)),
                images=[item.get("pic_url", "")] if item.get("pic_url") else [],
                stock=item.get("num", 0),
                platform_data=item,
            ))
        return PageResult(items=items, total=data.get("total_results", 0), page=page, page_size=page_size)

    async def fetch_product_detail(self, product_id: str) -> ProductDTO:
        client = TaobaoClient(self.app_key, self.app_secret)
        data = await client.call_api(
            method="taobao.item.seller.get",
            params={"num_iid": product_id, "fields": "num_iid,title,price,desc,pic_url,item_imgs,num"},
            session_key=self.access_token,
        )
        item = data.get("item", {})
        images = [img.get("url", "") for img in item.get("item_imgs", {}).get("item_img", [])]
        return ProductDTO(
            platform_product_id=str(item.get("num_iid", "")),
            title=item.get("title", ""),
            price=float(item.get("price", 0)),
            description=item.get("desc", ""),
            images=images,
            stock=item.get("num", 0),
            platform_data=item,
        )

    async def fetch_updated_products(self, since: datetime) -> list[ProductDTO]:
        client = TaobaoClient(self.app_key, self.app_secret)
        data = await client.call_api(
            method="taobao.items.onsale.get",
            params={
                "start_modified": since.strftime("%Y-%m-%d %H:%M:%S"),
                "fields": "num_iid,title,price,pic_url,num",
                "page_size": 200,
            },
            session_key=self.access_token,
        )
        items = []
        for item in data.get("items", {}).get("item", []):
            items.append(ProductDTO(
                platform_product_id=str(item.get("num_iid", "")),
                title=item.get("title", ""),
                price=float(item.get("price", 0)),
                images=[item.get("pic_url", "")] if item.get("pic_url") else [],
                stock=item.get("num", 0),
                platform_data=item,
            ))
        return items

    async def upload_image(self, product_id: str, image_url: str) -> str:
        raise NotImplementedError("淘宝图片上传需要特殊授权")

    async def upload_video(self, product_id: str, video_url: str) -> str:
        raise NotImplementedError("淘宝视频上传需要特殊授权")

    async def update_product(self, product_id: str, data: dict) -> bool:
        client = TaobaoClient(self.app_key, self.app_secret)
        params = {"num_iid": product_id}
        params.update(data)
        await client.call_api(method="taobao.item.update", params=params, session_key=self.access_token)
        return True

    # ===== 订单 =====
    async def fetch_orders(self, page=1, page_size=50, start_time=None, end_time=None, status=None) -> PageResult:
        client = TaobaoClient(self.app_key, self.app_secret)
        params = {
            "page_no": page,
            "page_size": page_size,
            "fields": "tid,payment,status,created,pay_time,consign_time,end_time,buyer_nick,num,title,price,total_fee",
        }
        if start_time:
            params["start_created"] = start_time.strftime("%Y-%m-%d %H:%M:%S")
        if end_time:
            params["end_created"] = end_time.strftime("%Y-%m-%d %H:%M:%S")
        if status:
            params["status"] = status

        data = await client.call_api(method="taobao.trades.sold.get", params=params, session_key=self.access_token)
        items = []
        for trade in data.get("trades", {}).get("trade", []):
            items.append(OrderDTO(
                platform_order_id=str(trade.get("tid", "")),
                product_title=trade.get("title", ""),
                buyer_id=trade.get("buyer_nick", ""),
                quantity=trade.get("num", 1),
                total_amount=float(trade.get("total_fee", 0)),
                status=trade.get("status", ""),
                platform_data=trade,
            ))
        return PageResult(items=items, total=data.get("total_results", 0), page=page, page_size=page_size)

    async def fetch_order_detail(self, order_id: str) -> OrderDTO:
        client = TaobaoClient(self.app_key, self.app_secret)
        data = await client.call_api(
            method="taobao.trade.fullinfo.get",
            params={"tid": order_id, "fields": "tid,payment,status,created,pay_time,consign_time,end_time,buyer_nick,num,title,price,total_fee,refund_fee"},
            session_key=self.access_token,
        )
        trade = data.get("trade", {})
        return OrderDTO(
            platform_order_id=str(trade.get("tid", "")),
            product_title=trade.get("title", ""),
            buyer_id=trade.get("buyer_nick", ""),
            quantity=trade.get("num", 1),
            total_amount=float(trade.get("total_fee", 0)),
            status=trade.get("status", ""),
            refund_amount=float(trade.get("refund_fee", 0)) if trade.get("refund_fee") else None,
            platform_data=trade,
        )

    # ===== 售后 =====
    async def fetch_aftersales(self, page=1, page_size=50, status=None) -> PageResult:
        client = TaobaoClient(self.app_key, self.app_secret)
        params = {"page_no": page, "page_size": page_size, "fields": "refund_id,tid,status,reason,refund_fee,created"}
        if status:
            params["status"] = status
        data = await client.call_api(method="taobao.refunds.receive.get", params=params, session_key=self.access_token)
        items = []
        for refund in data.get("refunds", {}).get("refund", []):
            items.append(AfterSaleDTO(
                platform_aftersale_id=str(refund.get("refund_id", "")),
                order_id=str(refund.get("tid", "")),
                status=refund.get("status", ""),
                reason=refund.get("reason", ""),
                refund_amount=float(refund.get("refund_fee", 0)),
                platform_data=refund,
            ))
        return PageResult(items=items, total=data.get("total_results", 0), page=page, page_size=page_size)

    async def get_aftersale_detail(self, aftersale_id: str) -> AfterSaleDTO:
        client = TaobaoClient(self.app_key, self.app_secret)
        data = await client.call_api(
            method="taobao.refund.get",
            params={"refund_id": aftersale_id, "fields": "refund_id,tid,status,reason,refund_fee"},
            session_key=self.access_token,
        )
        refund = data.get("refund", {})
        return AfterSaleDTO(
            platform_aftersale_id=str(refund.get("refund_id", "")),
            order_id=str(refund.get("tid", "")),
            status=refund.get("status", ""),
            reason=refund.get("reason", ""),
            refund_amount=float(refund.get("refund_fee", 0)),
            platform_data=refund,
        )

    async def approve_refund(self, aftersale_id: str) -> bool:
        client = TaobaoClient(self.app_key, self.app_secret)
        await client.call_api(
            method="taobao.refund.refuse",  # 淘宝用 agree
            params={"refund_id": aftersale_id},
            session_key=self.access_token,
        )
        return True

    async def reject_refund(self, aftersale_id: str, reason: str) -> bool:
        client = TaobaoClient(self.app_key, self.app_secret)
        await client.call_api(
            method="taobao.refund.refuse",
            params={"refund_id": aftersale_id, "refuse_message": reason},
            session_key=self.access_token,
        )
        return True
```

**Step 3: 创建 `__init__.py`**

```python
# backend/services/platform/taobao/__init__.py
"""淘宝/天猫平台适配"""
```

**Step 4: 在 adapter_factory.py 和 platform_gateway.py 中注册 import**

在 `backend/services/platform/adapter_factory.py` 添加：
```python
import services.platform.taobao.adapter  # noqa: F401
```

在 `backend/api/routers/platform_gateway.py` 的适配器 import 区域添加：
```python
import services.platform.taobao.adapter  # noqa: F401
```

**Step 5: 提交**

```bash
git add backend/services/platform/taobao/
git commit -m "feat: 添加淘宝/天猫平台适配器"
```

---

### Task 13: 京东适配器

**Files:**
- Create: `backend/services/platform/jd/__init__.py`
- Create: `backend/services/platform/jd/client.py`
- Create: `backend/services/platform/jd/adapter.py`

实现方式与 Task 12 类似，关键差异：
- **API 基地址**: `https://api.jd.com/routerjson`
- **签名**: MD5，格式 `secret + key1value1... + secret`
- **OAuth URL**: `https://oauth.jd.com/oauth/authorize`
- **Token URL**: `https://oauth.jd.com/oauth/token`
- **API 方法名**: `jd.union.open.goods.query`（商品）、`jd.pop.order.search`（订单）等
- **售后**: `jd.pop.afs.soa.refund.applyList`

**Step 1: 创建 JD 客户端和适配器**（代码结构同淘宝，替换 API 方法名和签名逻辑）

**Step 2: 注册适配器**

```python
@register("jd")
class JdAdapter(BasePlatformAdapter):
    ...
```

**Step 3: 提交**

```bash
git add backend/services/platform/jd/
git commit -m "feat: 添加京东平台适配器"
```

---

### Task 14: 快手适配器

**Files:**
- Create: `backend/services/platform/kuaishou/__init__.py`
- Create: `backend/services/platform/kuaishou/client.py`
- Create: `backend/services/platform/kuaishou/adapter.py`

关键差异：
- **API 基地址**: `https://open.kuaishou.com/openapi`
- **签名**: SHA256
- **OAuth URL**: `https://open.kuaishou.com/oauth2/authorize`
- **Token URL**: `https://open.kuaishou.com/oauth2/access_token`
- **消息**: 支持 Webhook + 轮询

**Step 1: 创建客户端和适配器**（代码结构同前）

**Step 2: 注册适配器**

```python
@register("kuaishou")
class KuaishouAdapter(BasePlatformAdapter):
    ...
```

**Step 3: 提交**

```bash
git add backend/services/platform/kuaishou/
git commit -m "feat: 添加快手平台适配器"
```

---

## 阶段四：前端 + 集成

### Task 15: 前端类型定义更新

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/lib/api/settings.ts`

**Step 1: 添加平台相关类型**

在 `frontend/src/types/index.ts` 中添加：

```typescript
// 平台类型
export type EcommercePlatform = 'pinduoduo' | 'douyin' | 'taobao' | 'jd' | 'kuaishou';

// 授权状态
export type AuthorizationStatus = 'pending' | 'authorized' | 'expired' | 'revoked';

// ISV 应用
export interface PlatformApp {
  platform_type: EcommercePlatform;
  app_name: string;
  status: string;
}

// 平台配置（扩展）
export interface PlatformConfig {
  id: number;
  tenant_id: string;
  platform_type: EcommercePlatform;
  app_key: string;
  shop_id: string | null;
  shop_name: string | null;
  is_active: boolean;
  authorization_status: AuthorizationStatus;
  auto_reply_threshold: number;
  human_takeover_message: string | null;
  expires_at: string | null;
  token_expires_at: string | null;
  refresh_expires_at: string | null;
  last_token_refresh: string | null;
  scopes: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

// 售后记录
export interface AfterSaleRecord {
  id: number;
  platform_config_id: number;
  platform_aftersale_id: string;
  order_id: number | null;
  aftersale_type: 'refund_only' | 'return_refund' | 'exchange';
  status: string;
  reason: string | null;
  refund_amount: number;
  buyer_id: string | null;
  created_at: string;
}
```

**Step 2: 添加平台 API 调用**

在 `frontend/src/lib/api/settings.ts` 或新建 `frontend/src/lib/api/platform.ts` 中添加：

```typescript
// frontend/src/lib/api/platform.ts
import { apiClient } from './client';
import type { PlatformApp, PlatformConfig } from '@/types';

export const platformApi = {
  // 获取可用的 ISV 应用
  getApps: () =>
    apiClient.get<PlatformApp[]>('/platform/apps'),

  // 获取租户的平台配置
  getConfigs: () =>
    apiClient.get<PlatformConfig[]>('/platform/configs'),

  // 发起 OAuth 授权
  getAuthUrl: (platformType: string, redirectUri: string, configId?: number) => {
    const params = new URLSearchParams({ redirect_uri: redirectUri });
    if (configId) params.set('config_id', String(configId));
    return `/api/v1/platform/${platformType}/auth?${params}`;
  },

  // 断开平台连接
  disconnect: (configId: number) =>
    apiClient.delete(`/platform/configs/${configId}`),

  // 更新配置
  updateConfig: (configId: number, data: Partial<PlatformConfig>) =>
    apiClient.put(`/platform/configs/${configId}`, data),
};
```

**Step 3: 提交**

```bash
git add frontend/src/types/index.ts frontend/src/lib/api/platform.ts
git commit -m "feat: 添加前端平台对接类型和 API"
```

---

### Task 16: 前端平台授权管理页面

**Files:**
- Create: `frontend/src/components/settings/PlatformManager.tsx`
- Modify: `frontend/src/app/(dashboard)/settings/page.tsx`

**Step 1: 创建 PlatformManager 组件**

创建一个新的平台管理组件，包含：
1. 五大平台卡片（显示授权状态）
2. 已授权店铺列表
3. 授权/取消授权操作
4. 同步设置（自动回复阈值、转人工提示语）

关键 UI 元素：
- 使用 Ant Design Card 组件展示各平台
- 使用 Tag 组件展示授权状态（绿色=已授权，灰色=未授权，红色=已过期）
- 使用 Table 展示已授权店铺列表
- 使用 Modal + Form 展示店铺管理弹窗

**Step 2: 在设置页面中集成**

在 `settings/page.tsx` 的「平台对接」Tab 中替换现有的 PlatformConfigCard 为新的 PlatformManager。

**Step 3: 提交**

```bash
git add frontend/src/components/settings/PlatformManager.tsx frontend/src/app/\(dashboard\)/settings/page.tsx
git commit -m "feat: 添加平台授权管理 UI"
```

---

### Task 17: 移除旧平台路由（可选）

**Files:**
- Modify: `backend/api/routers/platform.py`
- Modify: `backend/api/main.py`

在确认新的 `platform_gateway.py` 路由完全工作后：

**Step 1: 在旧路由上添加 Deprecated 标记**

暂时保留旧路由但添加 `deprecated=True` 标记，在验证新路由完全正常后再移除。

**Step 2: 提交**

```bash
git add backend/api/routers/platform.py backend/api/main.py
git commit -m "chore: 标记旧平台路由为 deprecated"
```

---

### Task 18: 数据库迁移脚本

**Files:**
- Create: `backend/migrations/005_add_platform_isv_tables.py`

**Step 1: 创建迁移脚本**

按照项目约定使用 raw SQL（`op.execute`）：

```python
"""添加 ISV 平台对接相关表和字段"""

def upgrade():
    # 创建 platform_apps 表
    op.execute("""
        CREATE TABLE IF NOT EXISTS platform_apps (
            id SERIAL PRIMARY KEY,
            platform_type VARCHAR(32) UNIQUE NOT NULL,
            app_name VARCHAR(128) NOT NULL,
            app_key VARCHAR(128) NOT NULL,
            app_secret VARCHAR(512) NOT NULL,
            callback_url TEXT,
            webhook_url TEXT,
            scopes JSON,
            status VARCHAR(16) DEFAULT 'active',
            extra_config JSON,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    """)

    # 创建 after_sale_records 表
    op.execute("""
        CREATE TABLE IF NOT EXISTS after_sale_records (
            id SERIAL PRIMARY KEY,
            tenant_id VARCHAR(64) NOT NULL,
            platform_config_id INTEGER NOT NULL,
            platform_aftersale_id VARCHAR(128) NOT NULL,
            order_id INTEGER,
            aftersale_type VARCHAR(32) DEFAULT 'refund_only',
            status VARCHAR(32) DEFAULT 'pending',
            reason TEXT,
            refund_amount FLOAT DEFAULT 0.0,
            buyer_id VARCHAR(128),
            platform_data JSON,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_aftersale_tenant_config ON after_sale_records(tenant_id, platform_config_id);
        CREATE INDEX IF NOT EXISTS idx_aftersale_platform_id ON after_sale_records(platform_aftersale_id);
    """)

    # 创建 webhook_events 表
    op.execute("""
        CREATE TABLE IF NOT EXISTS webhook_events (
            id SERIAL PRIMARY KEY,
            tenant_id VARCHAR(64) NOT NULL,
            event_id VARCHAR(128) NOT NULL,
            platform_type VARCHAR(32) NOT NULL,
            platform_config_id INTEGER,
            event_type VARCHAR(32) NOT NULL,
            payload JSON,
            status VARCHAR(16) DEFAULT 'received',
            retry_count INTEGER DEFAULT 0,
            error_message TEXT,
            processed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_event_id ON webhook_events(event_id);
        CREATE INDEX IF NOT EXISTS idx_webhook_event_status ON webhook_events(status);
        CREATE INDEX IF NOT EXISTS idx_webhook_event_platform ON webhook_events(platform_type, platform_config_id);
    """)

    # 扩展 platform_configs 表
    op.execute("""
        ALTER TABLE platform_configs ADD COLUMN IF NOT EXISTS authorization_status VARCHAR(16) DEFAULT 'pending';
        ALTER TABLE platform_configs ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP;
        ALTER TABLE platform_configs ADD COLUMN IF NOT EXISTS refresh_expires_at TIMESTAMP;
        ALTER TABLE platform_configs ADD COLUMN IF NOT EXISTS last_token_refresh TIMESTAMP;
        ALTER TABLE platform_configs ADD COLUMN IF NOT EXISTS platform_app_id INTEGER;
        ALTER TABLE platform_configs ADD COLUMN IF NOT EXISTS scopes JSON;
        ALTER TABLE platform_configs ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(256);
        ALTER TABLE platform_configs ADD COLUMN IF NOT EXISTS extra_config JSON;
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS webhook_events;")
    op.execute("DROP TABLE IF EXISTS after_sale_records;")
    op.execute("DROP TABLE IF EXISTS platform_apps;")
    op.execute("""
        ALTER TABLE platform_configs DROP COLUMN IF EXISTS authorization_status;
        ALTER TABLE platform_configs DROP COLUMN IF EXISTS token_expires_at;
        ALTER TABLE platform_configs DROP COLUMN IF EXISTS refresh_expires_at;
        ALTER TABLE platform_configs DROP COLUMN IF EXISTS last_token_refresh;
        ALTER TABLE platform_configs DROP COLUMN IF EXISTS platform_app_id;
        ALTER TABLE platform_configs DROP COLUMN IF EXISTS scopes;
        ALTER TABLE platform_configs DROP COLUMN IF EXISTS webhook_secret;
        ALTER TABLE platform_configs DROP COLUMN IF EXISTS extra_config;
    """)
```

**Step 2: 提交**

```bash
git add backend/migrations/005_add_platform_isv_tables.py
git commit -m "feat: 添加 ISV 平台对接数据库迁移"
```

---

### Task 19: 集成测试

**Files:**
- Create: `backend/tests/test_platform_integration.py`

**Step 1: 写集成测试**

测试以下场景：
1. AdapterRegistry 所有5个平台都已注册
2. PlatformGateway 路由正确响应
3. 各适配器 `get_auth_url()` 返回正确的授权 URL
4. DTO 转换正确性
5. 事件解析正确性

**Step 2: 运行所有测试**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All PASS

**Step 3: 提交**

```bash
git add backend/tests/test_platform_integration.py
git commit -m "test: 添加平台对接集成测试"
```

---

## 依赖关系

```
Task 1 (DTO)
    ↓
Task 2 (PlatformApp) ──┐
Task 3 (AfterSale+Event)├── Task 4 (PlatformConfig扩展) → Task 5 (BasePlatformAdapter)
                        │         ↓
                        └──→ Task 6 (AdapterRegistry) → Task 7 (PlatformGateway)
                                    ↓
                             Task 8 (重构PDD) → Task 9 (重构Douyin)
                                    ↓
                             Task 10 (Token刷新) + Task 11 (速率限制)
                                    ↓
                      Task 12 (淘宝) + Task 13 (京东) + Task 14 (快手)  ← 可并行
                                    ↓
                      Task 15 (前端类型) → Task 16 (前端UI)
                                    ↓
                      Task 17 (清理旧路由) + Task 18 (迁移脚本) + Task 19 (集成测试)
```

---

## 注意事项

1. **环境变量**: 新平台的 ISV 应用凭证存储在 `platform_apps` 表中（通过管理后台配置），而非 `.env`
2. **向后兼容**: 旧的 `platform.py` 路由保留到新路由完全验证后再移除
3. **淘宝 TMC**: 淘宝消息通道是长连接，初期可用轮询代替，后续再实现 TMC 客户端
4. **测试**: 各平台 API 测试需要 mock httpx 请求，避免实际调用外部 API
5. **加密**: 所有 `app_secret` 使用现有的 `encrypt_field()` / `decrypt_field()` 加密存储
