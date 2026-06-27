"""快手平台适配器"""
import json
import logging
from datetime import datetime

from services.platform.adapter_registry import register
from services.platform.base_adapter import BasePlatformAdapter
from services.platform.dto import (
    ProductDTO, OrderDTO, AfterSaleDTO, PageResult, TokenResult,
    PlatformEvent, MessageEvent, EventType, PlatformType,
)
from services.platform.kuaishou.client import KuaishouClient

logger = logging.getLogger(__name__)

KS_AUTH_URL = "https://open.kuaishou.com/oauth2/authorize"


@register("kuaishou")
class KuaishouAdapter(BasePlatformAdapter):
    """快手平台适配器"""

    def get_auth_url(self, state: str, redirect_uri: str) -> str:
        import urllib.parse
        params = {
            "response_type": "code",
            "app_id": self.app_key,
            "redirect_uri": redirect_uri,
            "state": state,
            "scope": "merchant_product,merchant_order,merchant_refund,merchant_im",
        }
        return f"{KS_AUTH_URL}?{urllib.parse.urlencode(params)}"

    async def exchange_token(self, code: str) -> TokenResult:
        client = KuaishouClient(self.app_key, self.app_secret)
        data = await client.get_access_token(code)
        return TokenResult(
            access_token=data.get("access_token", ""),
            refresh_token=data.get("refresh_token"),
            expires_in=int(data.get("expires_in", 172800)),
            shop_id=str(data.get("open_id", "")),
        )

    async def refresh_token(self, refresh_token: str) -> TokenResult:
        client = KuaishouClient(self.app_key, self.app_secret)
        data = await client.refresh_access_token(refresh_token)
        return TokenResult(
            access_token=data.get("access_token", ""),
            refresh_token=data.get("refresh_token"),
            expires_in=int(data.get("expires_in", 172800)),
        )

    def verify_webhook(self, headers: dict, body: bytes) -> bool:
        signature = headers.get("x-ks-sign", "") or headers.get("sign", "")
        if not signature:
            return True
        client = KuaishouClient(self.app_key, self.app_secret)
        return client.verify_webhook_signature(body, signature)

    def parse_webhook_event(self, body: dict) -> list[PlatformEvent]:
        events = []
        messages = body.get("data", [body]) if isinstance(body, dict) else [body]
        for msg in messages:
            content = msg.get("content", "")
            if isinstance(content, str):
                try:
                    content_data = json.loads(content)
                    content = content_data.get("text", content)
                except Exception:
                    pass

            shop_id = str(msg.get("seller_id") or msg.get("shop_id") or "")
            buyer_id = str(msg.get("buyer_open_id") or msg.get("buyer_id") or "")
            conversation_id = str(msg.get("conversation_id") or msg.get("session_id") or "")

            if content or conversation_id:
                events.append(MessageEvent(
                    event_type=EventType.MESSAGE.value,
                    platform_type=PlatformType.KUAISHOU.value,
                    shop_id=shop_id,
                    buyer_id=buyer_id,
                    conversation_id=conversation_id,
                    content=content,
                    msg_type="text",
                    raw_data=msg,
                    event_id=str(msg.get("msg_id") or f"ks_{shop_id}_{int(datetime.utcnow().timestamp())}"),
                ))
        return events

    async def send_message(self, conversation_id: str, content: str, msg_type: str = "text") -> bool:
        client = KuaishouClient(self.app_key, self.app_secret)
        await client.send_message(
            access_token=self.access_token,
            buyer_id=conversation_id,
            content=content,
        )
        return True

    # ===== 商品 =====
    async def fetch_products(self, page=1, page_size=50) -> PageResult:
        client = KuaishouClient(self.app_key, self.app_secret)
        data = await client.call_api(
            method="open.item.list",
            params={"page": page, "limit": page_size},
            access_token=self.access_token,
        )
        items = []
        for item in data.get("item_list", []):
            images = item.get("image_list", [])
            if isinstance(images, str):
                images = [images]
            items.append(ProductDTO(
                platform_product_id=str(item.get("item_id", "")),
                title=item.get("title", ""),
                price=float(item.get("price", 0)) / 100,
                images=images,
                stock=item.get("stock", 0),
                status="active" if item.get("status") == 1 else "inactive",
                platform_data=item,
            ))
        return PageResult(items=items, total=data.get("total", 0), page=page, page_size=page_size)

    async def fetch_product_detail(self, product_id: str) -> ProductDTO:
        client = KuaishouClient(self.app_key, self.app_secret)
        data = await client.call_api(
            method="open.item.detail",
            params={"item_id": product_id},
            access_token=self.access_token,
        )
        item = data.get("item", data)
        images = item.get("image_list", [])
        if isinstance(images, str):
            images = [images]
        return ProductDTO(
            platform_product_id=str(item.get("item_id", "")),
            title=item.get("title", ""),
            price=float(item.get("price", 0)) / 100,
            description=item.get("desc", ""),
            images=images,
            stock=item.get("stock", 0),
            platform_data=item,
        )

    async def fetch_updated_products(self, since: datetime) -> list[ProductDTO]:
        client = KuaishouClient(self.app_key, self.app_secret)
        data = await client.call_api(
            method="open.item.list",
            params={"page": 1, "limit": 100, "begin_time": int(since.timestamp() * 1000)},
            access_token=self.access_token,
        )
        items = []
        for item in data.get("item_list", []):
            items.append(ProductDTO(
                platform_product_id=str(item.get("item_id", "")),
                title=item.get("title", ""),
                price=float(item.get("price", 0)) / 100,
                images=item.get("image_list", []),
                stock=item.get("stock", 0),
                platform_data=item,
            ))
        return items

    async def upload_image(self, product_id: str, image_url: str) -> str:
        raise NotImplementedError("快手图片上传需要特殊授权")

    async def upload_video(self, product_id: str, video_url: str) -> str:
        raise NotImplementedError("快手视频上传需要特殊授权")

    async def update_product(self, product_id: str, data: dict) -> bool:
        client = KuaishouClient(self.app_key, self.app_secret)
        params = {"item_id": product_id}
        params.update(data)
        await client.call_api(method="open.item.update", params=params, access_token=self.access_token)
        return True

    # ===== 订单 =====
    async def fetch_orders(self, page=1, page_size=50, start_time=None, end_time=None, status=None) -> PageResult:
        client = KuaishouClient(self.app_key, self.app_secret)
        params: dict = {"page": page, "limit": page_size}
        if start_time:
            params["begin_time"] = int(start_time.timestamp() * 1000)
        if end_time:
            params["end_time"] = int(end_time.timestamp() * 1000)
        if status:
            params["order_status"] = status

        data = await client.call_api(method="open.order.list", params=params, access_token=self.access_token)
        items = []
        for order in data.get("order_list", []):
            items.append(OrderDTO(
                platform_order_id=str(order.get("oid", "")),
                product_title=order.get("item_title", ""),
                buyer_id=str(order.get("buyer_open_id", "")),
                quantity=order.get("num", 1),
                total_amount=float(order.get("total_fee", 0)) / 100,
                status=str(order.get("status", "")),
                platform_data=order,
            ))
        return PageResult(items=items, total=data.get("total", 0), page=page, page_size=page_size)

    async def fetch_order_detail(self, order_id: str) -> OrderDTO:
        client = KuaishouClient(self.app_key, self.app_secret)
        data = await client.call_api(
            method="open.order.detail",
            params={"oid": order_id},
            access_token=self.access_token,
        )
        order = data.get("order", data)
        return OrderDTO(
            platform_order_id=str(order.get("oid", "")),
            product_title=order.get("item_title", ""),
            buyer_id=str(order.get("buyer_open_id", "")),
            quantity=order.get("num", 1),
            total_amount=float(order.get("total_fee", 0)) / 100,
            status=str(order.get("status", "")),
            refund_amount=float(order.get("refund_fee", 0)) / 100 if order.get("refund_fee") else None,
            platform_data=order,
        )

    # ===== 售后 =====
    async def fetch_aftersales(self, page=1, page_size=50, status=None) -> PageResult:
        client = KuaishouClient(self.app_key, self.app_secret)
        params: dict = {"page": page, "limit": page_size}
        if status:
            params["refund_status"] = status
        try:
            data = await client.call_api(
                method="open.refund.list",
                params=params,
                access_token=self.access_token,
            )
            items = []
            for item in data.get("refund_list", []):
                items.append(AfterSaleDTO(
                    platform_aftersale_id=str(item.get("refund_id", "")),
                    order_id=str(item.get("oid", "")),
                    aftersale_type="refund_only" if item.get("refund_type") == 1 else "return_refund",
                    status=str(item.get("refund_status", "")),
                    reason=item.get("reason", ""),
                    refund_amount=float(item.get("refund_fee", 0)) / 100,
                    buyer_id=str(item.get("buyer_open_id", "")),
                    platform_data=item,
                ))
            return PageResult(items=items, total=data.get("total", 0), page=page, page_size=page_size)
        except Exception:
            return PageResult(items=[], total=0, page=page, page_size=page_size)

    async def get_aftersale_detail(self, aftersale_id: str) -> AfterSaleDTO:
        client = KuaishouClient(self.app_key, self.app_secret)
        data = await client.call_api(
            method="open.refund.detail",
            params={"refund_id": aftersale_id},
            access_token=self.access_token,
        )
        item = data.get("refund", data)
        return AfterSaleDTO(
            platform_aftersale_id=aftersale_id,
            order_id=str(item.get("oid", "")),
            status=str(item.get("refund_status", "")),
            reason=item.get("reason", ""),
            refund_amount=float(item.get("refund_fee", 0)) / 100,
            platform_data=item,
        )

    async def approve_refund(self, aftersale_id: str) -> bool:
        client = KuaishouClient(self.app_key, self.app_secret)
        await client.call_api(
            method="open.refund.agree",
            params={"refund_id": aftersale_id},
            access_token=self.access_token,
        )
        return True

    async def reject_refund(self, aftersale_id: str, reason: str) -> bool:
        client = KuaishouClient(self.app_key, self.app_secret)
        await client.call_api(
            method="open.refund.reject",
            params={"refund_id": aftersale_id, "reason": reason},
            access_token=self.access_token,
        )
        return True
