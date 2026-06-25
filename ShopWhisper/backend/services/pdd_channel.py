import hashlib
from core.config import settings


class PddChannel:
    """拼多多消息渠道适配器"""

    def __init__(self, webhook_token: str | None = None):
        self.webhook_token = webhook_token or settings.pdd_webhook_token
        self.human_keywords = settings.pdd_human_takeover_keywords

    def verify_signature(self, body: bytes, signature: str) -> bool:
        """验证拼多多 Webhook 签名"""
        expected = hashlib.md5(
            self.webhook_token.encode("utf-8") + body
        ).hexdigest()
        return expected == signature

    def parse_message(self, payload: dict) -> dict | None:
        """将拼多多消息格式转换为内部统一格式"""
        if payload.get("type") != "IM_NEW_MESSAGE":
            return None
        data = payload.get("data", {})
        return {
            "conversation_id": data.get("conversation_id"),
            "sender_id": data.get("sender_id"),
            "content": data.get("content", ""),
            "msg_type": data.get("msg_type", 1),
            "is_buyer": True,
            "channel": "pinduoduo",
        }

    def should_transfer_to_human(self, content: str) -> bool:
        """检测是否需要转人工"""
        return any(kw in content for kw in self.human_keywords)
