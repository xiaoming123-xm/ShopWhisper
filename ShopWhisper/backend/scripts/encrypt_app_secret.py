#!/usr/bin/env python3
"""
一次性脚本：加密 PlatformApp 的 app_secret 并插入或更新数据库记录。

用法：
    # 加密并输出密文（不写入数据库）
    python scripts/encrypt_app_secret.py --encrypt "YOUR_APP_SECRET"

    # 创建完整的 PlatformApp 记录
    python scripts/encrypt_app_secret.py --create \
        --platform-type douyin \
        --app-name "抖店智能客服" \
        --app-key "YOUR_APP_KEY" \
        --app-secret "YOUR_APP_SECRET" \
        --callback-url "https://example.com/api/v1/platform/douyin/callback" \
        --webhook-url "https://example.com/api/v1/platform/douyin/webhook" \
        --scopes "shop.product,shop.order,shop.afterSale,im,shop.material"

    # 更新已有记录的 app_secret
    python scripts/encrypt_app_secret.py --update \
        --platform-type douyin \
        --app-secret "NEW_APP_SECRET"
"""
import argparse
import asyncio
import sys
from pathlib import Path

# 将 backend 目录加入路径
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def encrypt_only(secret: str) -> None:
    """仅加密并打印密文"""
    from core.crypto import encrypt_field

    encrypted = encrypt_field(secret)
    print(f"明文: {secret}")
    print(f"密文: {encrypted}")
    print("\n可直接用于 SQL INSERT 的 app_secret 值。")


async def create_record(args: argparse.Namespace) -> None:
    """创建 PlatformApp 记录"""
    from core.crypto import encrypt_field
    from db.session import AsyncSessionLocal as async_session_factory
    from models.platform_app import PlatformApp
    from sqlalchemy import select

    async with async_session_factory() as session:
        # 检查是否已存在
        existing = await session.execute(
            select(PlatformApp).where(PlatformApp.platform_type == args.platform_type)
        )
        if existing.scalar_one_or_none():
            print(f"错误: 平台 {args.platform_type} 的应用已存在，请使用 --update 更新")
            sys.exit(1)

        scopes = args.scopes.split(",") if args.scopes else None

        app = PlatformApp(
            platform_type=args.platform_type,
            app_name=args.app_name,
            app_key=args.app_key,
            app_secret=encrypt_field(args.app_secret),
            callback_url=args.callback_url,
            webhook_url=args.webhook_url,
            scopes=scopes,
            status="active",
        )
        session.add(app)
        await session.commit()
        await session.refresh(app)

        print(f"创建成功!")
        print(f"  ID: {app.id}")
        print(f"  平台: {app.platform_type}")
        print(f"  应用名: {app.app_name}")
        print(f"  App Key: {app.app_key}")
        print(f"  状态: {app.status}")


async def update_secret(args: argparse.Namespace) -> None:
    """更新已有记录的 app_secret"""
    from core.crypto import encrypt_field
    from db.session import AsyncSessionLocal as async_session_factory
    from models.platform_app import PlatformApp
    from sqlalchemy import select

    async with async_session_factory() as session:
        result = await session.execute(
            select(PlatformApp).where(PlatformApp.platform_type == args.platform_type)
        )
        app = result.scalar_one_or_none()
        if not app:
            print(f"错误: 未找到平台 {args.platform_type} 的应用")
            sys.exit(1)

        app.app_secret = encrypt_field(args.app_secret)
        await session.commit()

        print(f"更新成功! 平台 {args.platform_type} 的 app_secret 已加密更新。")


def main() -> None:
    parser = argparse.ArgumentParser(description="PlatformApp Secret 加密管理工具")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--encrypt", metavar="SECRET", help="仅加密输出，不写入数据库")
    group.add_argument("--create", action="store_true", help="创建新的 PlatformApp 记录")
    group.add_argument("--update", action="store_true", help="更新已有记录的 app_secret")

    parser.add_argument("--platform-type", help="平台类型，如 douyin/pinduoduo")
    parser.add_argument("--app-name", help="应用名称")
    parser.add_argument("--app-key", help="应用 Key")
    parser.add_argument("--app-secret", help="应用 Secret（明文）")
    parser.add_argument("--callback-url", help="OAuth 回调地址")
    parser.add_argument("--webhook-url", help="Webhook 接收地址")
    parser.add_argument("--scopes", help="权限列表，逗号分隔")

    args = parser.parse_args()

    if args.encrypt:
        encrypt_only(args.encrypt)
        return

    if args.create:
        if not all([args.platform_type, args.app_name, args.app_key, args.app_secret]):
            parser.error("--create 需要 --platform-type, --app-name, --app-key, --app-secret")
        asyncio.run(create_record(args))

    elif args.update:
        if not all([args.platform_type, args.app_secret]):
            parser.error("--update 需要 --platform-type 和 --app-secret")
        asyncio.run(update_secret(args))


if __name__ == "__main__":
    main()
