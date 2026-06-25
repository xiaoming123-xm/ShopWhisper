#!/bin/bash

# 域名部署脚本 - your-domain.com
# 用途：自动化部署流程

set -e  # 遇到错误立即退出

echo "========================================="
echo "电商智能客服系统 - 域名部署脚本"
echo "域名: your-domain.com"
echo "========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}错误: 请使用 root 用户或 sudo 运行此脚本${NC}"
    exit 1
fi

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker 未安装${NC}"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}错误: Docker Compose 未安装${NC}"
    exit 1
fi

# 步骤 1: 检查 SSL 证书
echo -e "${YELLOW}[1/6] 检查 SSL 证书...${NC}"
if [ ! -f "/etc/letsencrypt/live/your-domain.com/fullchain.pem" ]; then
    echo -e "${RED}错误: SSL 证书不存在${NC}"
    echo "请先运行以下命令获取证书:"
    echo "sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com --email your-email@example.com --agree-tos"
    exit 1
fi
echo -e "${GREEN}✓ SSL 证书存在${NC}"

# 步骤 2: 检查证书有效期
echo -e "${YELLOW}[2/6] 检查证书有效期...${NC}"
CERT_EXPIRY=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/your-domain.com/fullchain.pem | cut -d= -f2)
CERT_EXPIRY_EPOCH=$(date -d "$CERT_EXPIRY" +%s)
CURRENT_EPOCH=$(date +%s)
DAYS_LEFT=$(( ($CERT_EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))

if [ $DAYS_LEFT -lt 30 ]; then
    echo -e "${YELLOW}警告: 证书将在 $DAYS_LEFT 天后过期，建议续期${NC}"
else
    echo -e "${GREEN}✓ 证书有效期: $DAYS_LEFT 天${NC}"
fi

# 步骤 3: 停止现有服务
echo -e "${YELLOW}[3/6] 停止现有服务...${NC}"
docker compose down
echo -e "${GREEN}✓ 服务已停止${NC}"

# 步骤 4: 构建镜像
echo -e "${YELLOW}[4/6] 构建 Docker 镜像...${NC}"
docker compose build api celery-worker frontend
echo -e "${GREEN}✓ 镜像构建完成${NC}"

# 步骤 5: 启动服务
echo -e "${YELLOW}[5/6] 启动服务...${NC}"
docker compose up -d
echo -e "${GREEN}✓ 服务已启动${NC}"

# 步骤 6: 等待服务就绪并验证
echo -e "${YELLOW}[6/6] 验证服务状态...${NC}"
sleep 10

# 检查容器状态
CONTAINERS=("shop-whisper-nginx" "shop-whisper-api" "shop-whisper-frontend")
for container in "${CONTAINERS[@]}"; do
    if docker ps | grep -q "$container"; then
        echo -e "${GREEN}✓ $container 运行中${NC}"
    else
        echo -e "${RED}✗ $container 未运行${NC}"
        docker compose logs "$container"
        exit 1
    fi
done

# 测试 HTTP 重定向
echo ""
echo -e "${YELLOW}测试 HTTP → HTTPS 重定向...${NC}"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -L http://your-domain.com)
if [ "$HTTP_STATUS" == "200" ]; then
    echo -e "${GREEN}✓ HTTP 重定向正常${NC}"
else
    echo -e "${YELLOW}警告: HTTP 状态码 $HTTP_STATUS${NC}"
fi

# 测试 HTTPS 访问
echo -e "${YELLOW}测试 HTTPS 访问...${NC}"
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://your-domain.com)
if [ "$HTTPS_STATUS" == "200" ]; then
    echo -e "${GREEN}✓ HTTPS 访问正常${NC}"
else
    echo -e "${RED}✗ HTTPS 状态码 $HTTPS_STATUS${NC}"
fi

# 测试健康检查
echo -e "${YELLOW}测试健康检查端点...${NC}"
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://your-domain.com/health)
if [ "$HEALTH_STATUS" == "200" ]; then
    echo -e "${GREEN}✓ 健康检查正常${NC}"
else
    echo -e "${YELLOW}警告: 健康检查状态码 $HEALTH_STATUS${NC}"
fi

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}部署完成！${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "访问地址:"
echo "  - 前端: https://your-domain.com"
echo "  - API 文档: https://your-domain.com/docs"
echo "  - 健康检查: https://your-domain.com/health"
echo ""
echo "查看日志:"
echo "  docker compose logs -f nginx"
echo "  docker compose logs -f api"
echo "  docker compose logs -f frontend"
echo ""
echo "查看服务状态:"
echo "  docker compose ps"
echo ""
