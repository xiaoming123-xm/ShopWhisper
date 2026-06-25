"""
字段级对称加密工具（Fernet）

密钥优先从 FIELD_ENCRYPT_KEY 环境变量读取，
否则从 settings.jwt_secret 派生（PBKDF2-HMAC-SHA256）。
"""
import base64
import hashlib
import os

from cryptography.fernet import Fernet


def _get_fernet() -> Fernet:
    raw_key = os.environ.get("FIELD_ENCRYPT_KEY")
    if raw_key:
        # 允许直接传入 base64url 编码的 32 字节密钥
        key = raw_key.encode() if isinstance(raw_key, str) else raw_key
    else:
        from core.config import settings
        # 从 jwt_secret 派生 32 字节密钥
        derived = hashlib.pbkdf2_hmac(
            "sha256",
            settings.jwt_secret.encode("utf-8"),
            b"shop-whisper-field-encrypt",
            iterations=100_000,
            dklen=32,
        )
        key = base64.urlsafe_b64encode(derived)
    return Fernet(key)


def encrypt_field(plaintext: str) -> str:
    """加密字段，返回 base64url 编码的密文字符串"""
    f = _get_fernet()
    return f.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_field(ciphertext: str) -> str:
    """解密字段，返回明文字符串"""
    f = _get_fernet()
    return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
