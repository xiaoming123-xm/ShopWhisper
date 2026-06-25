<div align="center">

# ShopWhisper

**面向电商场景的多租户 AI SaaS 平台**

独立主导从 0 到 1 的完整架构设计与核心链路开发——
集智能客服、AI 内容生成、商品管理与智能定价于一体，
具备生产级监控与一键部署能力。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-green.svg)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)](https://www.docker.com/)

[在线体验](https://www.ecomchat.cn/) · [API 文档](http://localhost:8000/docs) · [设计方案](./docs/设计方案.md)

</div>

---

## 这个项目解决了什么

电商商家在使用 AI 能力时面临三个核心瓶颈：**多租户数据隔离复杂**、**RAG 检索召回率低**、**平台数据异步同步不可靠**。ShopWhisper 针对这三点做了系统性的工程投入，而不是简单堆砌现有框架。

- **多租户隔离**：全链路 `tenant_id` 逻辑隔离，支持海量租户并发接入，API Key 与 JWT 双认证体系分别服务外部集成与管理后台场景。
- **RAG 召回质量**：Milvus 向量检索 + Sentence Transformers Embedding + 重排序三层架构，显著提升知识库语义检索准确率。
- **异步数据同步**：Celery + Redis 驱动的任务队列，支持电商平台商品与订单的全量/增量同步，任务状态可观测、失败可重试。

---

## 核心能力

### 智能客服引擎
- 基于 LangGraph 构建的有状态对话流，原生支持多轮上下文与摘要压缩
- 规则 + LLM 混合意图识别，覆盖订单查询、商品推荐、售后处理等核心场景
- WebSocket 全双工通信，流式响应毫秒级输出
- 拼多多 OAuth 授权 + Webhook 消息接收，AI 自动回复与人工接管无缝切换

### AI 内容生成
- 海报（图像）生成：接入火山引擎 `doubao-seedream` 系列模型，支持批量异步任务
- 视频生成：文生视频 / 图生视频，接入 `doubao-seedance` 系列模型
- 商品文案：标题与详情描述一键生成
- MinIO 对象存储统一管理生成素材，支持下载与一键回传电商平台

### 商品与订单管理
- 全量/增量同步，定时调度保持数据实时性
- 商品提示词管理：为每个 SKU 独立配置图像、视频、文案生成提示词
- 热销排行、买家统计、AI 生成周期性分析报告

### 智能定价
- 竞品数据管理 + 四种定价策略（竞争 / 高端 / 渗透 / 动态）
- AI 生成最低价、最高价、建议价及分析摘要

### 订阅与支付
- 支付宝、微信支付集成，套餐升降级按比例结算
- Redis 实时配额扣减，超额付费无感知

---

## 技术栈

| 层级 | 选型 |
|------|------|
| **后端框架** | FastAPI 0.109 + Uvicorn（异步 ASGI） |
| **ORM** | SQLAlchemy 2.0（异步模式） |
| **AI 框架** | LangChain 0.1 · LangGraph · Sentence Transformers |
| **模型服务** | 火山引擎（LLM · Embedding · 图像生成 · 视频生成） |
| **向量数据库** | Milvus |
| **任务队列** | Celery 5.3 + Redis Broker |
| **前端** | Next.js 14 App Router · React 18 · TypeScript · Ant Design 6 · Zustand 5 · Tailwind CSS |
| **数据存储** | PostgreSQL 14 · Redis 7 · MinIO |
| **网关** | Nginx 反向代理 |
| **监控** | Prometheus · Sentry · Flower |
| **部署** | Docker + Docker Compose（开发 & 生产双套配置） |

---

## 快速启动

### 前置条件

- Docker 20.10+ & Docker Compose 2.0+
- CPU 4 核+ / 内存 8 GB+ / 磁盘 20 GB+
- 操作系统：Linux / macOS / Windows（WSL2）

### 一键部署

```bash
git clone https://github.com/xiaoming123-xm/ShopWhisper.git
cd ShopWhisper

docker-compose up -d

# 确认所有服务健康
docker-compose ps
```

启动完成后可访问：

| 地址 | 说明 |
|------|------|
| `http://localhost/login` | 租户工作台 |
| `http://localhost/admin-login` | 超管后台（默认：admin / admin123456） |
| `http://localhost:8000/docs` | Swagger 交互式 API 文档 |
| `http://localhost:8000/health` | 健康检查 |
| `http://localhost:9001` | MinIO Console（minioadmin / minioadmin） |

### 本地开发模式

```bash
# 只启动基础设施
docker-compose up -d postgres redis

# 后端
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python init_db.py          # 建表 + 创建默认超管
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

# 前端（新终端）
cd frontend
npm install
npm run dev                # http://localhost:3000
```

### 数据库说明

项目使用 `init_db.py` 替代迁移工具，`SQLAlchemy Base.metadata.create_all()` 自动建立全部 47 张表并写入初始数据。该脚本幂等，可重复执行。Docker 部署时由 `db-init` 容器自动运行。

```bash
# 完全重置（⚠️ 会清空所有数据）
docker compose down -v
docker compose up -d
```

---

## 环境变量

```env
# 数据库
DATABASE_URL=postgresql+asyncpg://ecom_user:ecom_password@postgres:5432/shop_whisper

# Redis
REDIS_URL=redis://redis:6379/0

# JWT
JWT_SECRET=change-this-in-production
JWT_ACCESS_TOKEN_EXPIRE_HOURS=8
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# 火山引擎
VOLCENGINE_API_KEY=your-api-key
VOLCENGINE_API_BASE=https://ark.cn-beijing.volces.com/api/v3

# 模型 Endpoint（在火山引擎控制台「推理接入点」创建后获取）
LLM_MODEL=your-llm-endpoint-id
EMBEDDING_MODEL=your-embedding-endpoint-id
IMAGE_GEN_MODEL=your-image-gen-endpoint-id
VIDEO_GEN_MODEL=your-video-gen-endpoint-id
EMBEDDING_DIMENSION=2048
```

敏感配置请写入 `.env.local`，禁止提交至 Git。

---

## 项目结构

```
ShopWhisper/
├── backend/
│   ├── api/
│   │   ├── main.py            # 应用入口
│   │   ├── dependencies.py    # 依赖注入（认证、DB）
│   │   ├── middleware/        # 配额、限流、日志中间件
│   │   └── routers/           # 35 个路由模块
│   ├── core/                  # 配置、安全、权限、异常
│   ├── models/                # 32 个 SQLAlchemy ORM 模型
│   ├── schemas/               # 31 个 Pydantic 请求/响应模型
│   ├── services/              # 61 个业务逻辑服务
│   ├── tasks/                 # Celery 异步任务
│   ├── db/                    # session、redis、RLS 工具
│   ├── utils/                 # logger、Prometheus、Sentry、脱敏
│   ├── init_db.py
│   └── Dockerfile
├── frontend/
│   ├── src/app/
│   │   ├── (auth)/            # 登录 / 注册
│   │   ├── (dashboard)/       # 租户工作台（对话/商品/内容/知识库/定价/分析/设置）
│   │   └── (admin)/           # 超管后台（租户/订阅/支付/统计/审计/配置）
│   ├── src/components/
│   ├── src/store/             # Zustand 状态管理
│   ├── src/lib/api/           # API 客户端
│   └── Dockerfile
├── nginx/
├── docs/
├── scripts/                   # 部署脚本、测试脚本
├── docker-compose.yml         # 开发环境
├── docker-compose.prod.yml    # 生产环境
└── Jenkinsfile
```

---

## API 速览

完整文档见 `http://localhost:8000/docs`，以下为核心端点：

```bash
# 注册租户
curl -X POST http://localhost:8000/api/v1/tenant/register \
  -H "Content-Type: application/json" \
  -d '{"company_name":"测试","contact_name":"张三","contact_email":"test@example.com","password":"test123456"}'

# 创建对话会话
curl -X POST http://localhost:8000/api/v1/conversation/create \
  -H "X-API-Key: YOUR_KEY" \
  -d '{"user_id":"user123","channel":"web"}'

# 发起 AI 对话
curl -X POST http://localhost:8000/api/v1/ai-chat/chat \
  -H "X-API-Key: YOUR_KEY" \
  -d '{"conversation_id":"CONV_ID","message":"查一下我的订单","use_rag":true}'

# WebSocket 实时流式对话
# ws://localhost:8000/api/v1/ws/chat?api_key=YOUR_KEY
```

---

## 测试

```bash
./run_all_tests.sh          # 全量测试（后端单元 + E2E）
./scripts/smoke-test.sh     # 冒烟测试（快速验证核心链路）
cd frontend && npm run test:e2e   # Playwright E2E
```

---

## 生产部署（HTTPS）

```bash
sudo ./scripts/get-ssl-cert.sh    # 申请 SSL 证书
sudo ./scripts/deploy-domain.sh   # 部署至域名
```

**安全检查清单**
- [ ] 修改数据库密码、管理员默认密码（`admin123456`）、JWT Secret
- [ ] 仅对外暴露 80 / 443，其余端口限内网
- [ ] 定期备份：`docker-compose exec postgres pg_dump -U ecom_user shop_whisper > backup.sql`
- [ ] 敏感配置通过环境变量或 Secrets Manager 注入

---

## 服务端口

| 服务 | 端口 |
|------|------|
| Next.js 前端（含 API 代理） | 80 |
| FastAPI 后端 | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| MinIO Console | 9001 |

---

## 贡献

```bash
git checkout -b feature/your-feature
git commit -m 'feat: your feature'
git push origin feature/your-feature
# 提交 Pull Request
```

---

## 许可证

[MIT](LICENSE)

---

<div align="center">

⭐ 如果 ShopWhisper 对你有帮助，欢迎 Star！

**FastAPI · Next.js · LangChain · LangGraph · Milvus · PostgreSQL · Redis · MinIO · Ant Design**

</div>
