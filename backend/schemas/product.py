"""Product related Pydantic schemas."""
from datetime import datetime

from pydantic import BaseModel, Field

from schemas.base import BaseSchema, TimestampSchema


class ProductBase(BaseSchema):
    title: str = Field(..., min_length=1, max_length=512, description="Product title")
    description: str | None = Field(None, description="Product description")
    price: float = Field(..., ge=0, description="Current selling price")
    original_price: float | None = Field(None, ge=0, description="Original price")
    currency: str = Field("CNY", max_length=8, description="Currency")
    category: str | None = Field(None, max_length=128, description="Category")
    images: list[str] | None = Field(None, description="Image URLs")
    videos: list[str] | None = Field(None, description="Video URLs")
    attributes: dict | None = Field(None, description="SKU/spec attributes")
    sales_count: int = Field(0, ge=0, description="Sales count")
    stock: int = Field(0, ge=0, description="Stock")


class ProductResponse(ProductBase, TimestampSchema):
    id: int
    tenant_id: str
    platform_config_id: int
    platform_product_id: str
    status: str
    knowledge_base_id: int | None = None
    last_synced_at: datetime | None = None
    platform_data: dict | None = None


class ProductListQuery(BaseModel):
    keyword: str | None = None
    category: str | None = None
    status: str | None = Field(None, pattern="^(active|inactive|deleted)$")
    platform_config_id: int | None = None
    page: int = Field(1, ge=1)
    size: int = Field(20, ge=1, le=200)


class ProductPriceEstimateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)
    category: str = Field("服装/针织衫", max_length=128)
    material: str = Field("混纺", max_length=128)
    cost: float = Field(..., ge=0)
    stock: int = Field(..., ge=0)
    target_platform: str = Field("douyin_demo", max_length=64)
    image_url: str | None = None
    color: str | None = Field(None, max_length=64)
    size: str | None = Field(None, max_length=64)


class ProductPriceEstimateResponse(BaseModel):
    suggested_price: float
    min_price: float
    max_price: float
    confidence: float
    reasons: list[str]
    pricing_factors: dict[str, object]


class ProductDemoListingRequest(ProductPriceEstimateRequest):
    platform_config_id: int = Field(0, ge=0)
    description: str | None = None
    promo_prompt: str | None = Field(None, max_length=1000)
    final_price: float | None = Field(None, ge=0)
    original_price: float | None = Field(None, ge=0)


class ProductDemoListingResponse(BaseModel):
    product: ProductResponse
    estimate: ProductPriceEstimateResponse
    inventory_change: dict[str, int]
    platform_status: str
    platform_message: str


class SyncTaskResponse(TimestampSchema):
    id: int
    tenant_id: str
    platform_config_id: int
    sync_target: str
    sync_type: str
    status: str
    total_count: int
    synced_count: int
    failed_count: int
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None


class TriggerSyncRequest(BaseModel):
    platform_config_id: int
    sync_type: str = Field("full", pattern="^(full|incremental)$")


class SyncScheduleResponse(TimestampSchema):
    id: int
    tenant_id: str
    platform_config_id: int
    interval_minutes: int
    is_active: bool
    last_run_at: datetime | None = None
    next_run_at: datetime | None = None


class SyncScheduleUpdate(BaseModel):
    interval_minutes: int | None = Field(None, ge=10, le=1440)
    is_active: bool | None = None
