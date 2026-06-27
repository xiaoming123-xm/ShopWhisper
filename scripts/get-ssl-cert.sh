#!/bin/bash

# SSL 证书获取脚本
# 用途：自动获取 Let's Encrypt SSL 证书

set -e

echo "========================================="
echo "Let's Encrypt SSL 证书获取脚本"
echo "域名: your-domain.com, www.your-domain.com"
echo "========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}错误: 请使用 root 用户或 sudo 运行此脚本${NC}"
    exit 1
fi

# 检查 certbot 是否安装
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}Certbot 未安装，正在安装...${NC}"
    apt-get update
    apt-get install -y certbot
    echo -e "${GREEN}✓ Certbot 安装完成${NC}"
fi

# 提示输入邮箱
read -p "请输入邮箱地址（用于证书通知）: " EMAIL

if [ -z "$EMAIL" ]; then
    echo -e "${RED}错误: 邮箱地址不能为空${NC}"
    exit 1
fi

# 检查 80 端口是否被占用
if lsof -Pi :80 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${YELLOW}警告: 80 端口被占用，正在停止 Docker 服务...${NC}"
    cd "$(dirname "$0")/.."
    docker compose down
    echo -e "${GREEN}✓ Docker 服务已停止${NC}"
fi

# 获取证书
echo -e "${YELLOW}正在获取 SSL 证书...${NC}"
certbot certonly --standalone \
    -d your-domain.com \
    -d www.your-domain.com \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ SSL 证书获取成功${NC}"
    echo ""
    echo "证书文件位置:"
    echo "  - 完整证书链: /etc/letsencrypt/live/your-domain.com/fullchain.pem"
    echo "  - 私钥: /etc/letsencrypt/live/your-domain.com/privkey.pem"
    echo ""

    # 显示证书信息
    echo "证书信息:"
    certbot certificates

    echo ""
    echo -e "${GREEN}下一步: 运行部署脚本${NC}"
    echo "  sudo ./scripts/deploy-domain.sh"
else
    echo -e "${RED}✗ SSL 证书获取失败${NC}"
    exit 1
fi
