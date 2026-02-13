# Polyalphascan 部署指南

## 新功能概述

本次更新添加了以下功能：

### 1. Markets 页面
- 显示 Crypto 和 Finance 分类市场
- 实时价格更新
- 市场搜索和过滤
- 访问路径: `/markets`

### 2. Monitoring 页面
- 账户活动追踪
- 机器人检测
- 交易分析
- 访问路径: `/monitoring`

### 3. 性能优化
- 并行 LLM 处理（可选启用）
- 多 WebSocket 连接支持
- 增量更新策略

## 本地测试

### 1. 安装依赖

```bash
# 后端（如有新依赖）
cd backend
uv sync

# 前端
cd frontend
npm install
```

### 2. 启动服务

```bash
# 使用 make（推荐）
make dev

# 或手动启动
# 后端
cd backend && uv run python -m uvicorn server.main:app --reload --port 8000

# 前端
cd frontend && npm run dev
```

### 3. 验证新功能

访问以下页面确认功能正常：

- **Markets 页面**: http://localhost:3000/markets
- **Monitoring 页面**: http://localhost:3000/monitoring
- **API 文档**: http://localhost:8000/docs

### 4. 测试 API Endpoints

```bash
# 测试 Markets API
curl "http://localhost:8000/data/markets?category=crypto&limit=10"

# 测试 Monitoring API（替换为真实地址）
curl "http://localhost:8000/monitoring/accounts/0x1234567890123456789012345678901234567890"

# 测试 Bot Detection
curl "http://localhost:8000/monitoring/bots/detect/0x1234567890123456789012345678901234567890"
```

## Vercel 部署

### 方法 1: 通过 Git Push（推荐）

```bash
# 1. 提交更改
git add .
git commit -m "feat: add markets and monitoring features with performance optimizations"

# 2. 推送到 GitHub
git push origin main

# Vercel 会自动检测并部署
```

### 方法 2: 使用 Vercel CLI

```bash
# 1. 安装 Vercel CLI（如未安装）
npm i -g vercel

# 2. 登录
vercel login

# 3. 部署
cd frontend
vercel --prod
```

### 方法 3: 使用 Vercel MCP

```bash
# 使用 MCP 工具部署
manus-mcp-cli tool call deploy_to_vercel --server vercel
```

## 环境变量配置

### Vercel 环境变量

在 Vercel Dashboard 中添加以下环境变量：

```bash
# 必需的环境变量（已有）
OPENROUTER_API_KEY=sk-or-v1-...
BACKEND_URL=https://your-backend-url.com
CHAINSTACK_NODE=https://polygon-mainnet.core.chainstack.com/...

# 新增的可选环境变量
LLM_MAX_CONCURRENT=5
WS_MAX_CONNECTIONS=10
POLL_INTERVAL_SECONDS=30
```

### 后端环境变量

如果后端单独部署，确保 `.env` 文件包含：

```bash
# 从 .env.example 复制
cp .env.example .env

# 编辑 .env 文件，填入真实值
```

## 部署检查清单

### 部署前

- [ ] 本地测试所有新功能
- [ ] 检查 API endpoints 正常工作
- [ ] 验证前端页面渲染正确
- [ ] 确认环境变量已配置
- [ ] 运行 `npm run build` 确保前端可以构建

### 部署后

- [ ] 访问 Markets 页面，确认数据加载
- [ ] 访问 Monitoring 页面，测试账户追踪
- [ ] 检查 Vercel 部署日志无错误
- [ ] 测试 API endpoints 响应正常
- [ ] 验证 WebSocket 连接正常

## 常见问题

### Q1: Markets 页面显示 "No markets found"

**原因**: 后端 `events.json` 文件不存在或为空

**解决方案**:
```bash
# 运行 pipeline 生成数据
cd backend
uv run python -m core.runner
```

### Q2: Monitoring 页面返回 404

**原因**: Polymarket Data API 可能有速率限制或地址无活动

**解决方案**:
- 使用有交易历史的地址测试
- 检查 API 速率限制
- 查看后端日志获取详细错误

### Q3: WebSocket 连接失败

**原因**: CORS 或网络配置问题

**解决方案**:
```python
# 检查 backend/server/main.py 的 CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制为具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Q4: 并行 LLM 处理导致速率限制

**原因**: OpenRouter API 并发限制

**解决方案**:
```bash
# 降低并发数
LLM_MAX_CONCURRENT=3
```

## 回滚方案

如果新版本出现问题，可以快速回滚：

### Vercel 回滚

1. 访问 Vercel Dashboard
2. 进入项目 Deployments
3. 找到上一个稳定版本
4. 点击 "Promote to Production"

### Git 回滚

```bash
# 回滚到上一个 commit
git revert HEAD
git push origin main
```

## 性能监控

### 监控指标

部署后监控以下指标：

1. **API 响应时间**
   - Markets API: < 1s
   - Monitoring API: < 2s

2. **WebSocket 连接数**
   - 正常: 1-10 个连接
   - 异常: > 10 个连接

3. **内存使用**
   - 正常: < 512MB
   - 警告: > 1GB

4. **错误率**
   - 正常: < 1%
   - 警告: > 5%

### 日志查看

```bash
# Vercel 运行时日志
vercel logs

# 本地后端日志
tail -f backend/logs/app.log
```

## 生产环境优化

### 1. 启用 Redis 缓存（可选）

```bash
# 部署 Redis
# 使用 Upstash Redis（Vercel 推荐）或其他 Redis 服务

# 配置环境变量
ENABLE_REDIS_CACHE=true
REDIS_URL=redis://...
```

### 2. 配置 CDN

Vercel 自动提供 CDN，无需额外配置。

### 3. 启用压缩

```javascript
// next.config.js
module.exports = {
  compress: true,
  // ...
}
```

### 4. 优化图片

```javascript
// 使用 Next.js Image 组件
import Image from 'next/image'

<Image 
  src={market.icon} 
  width={32} 
  height={32} 
  alt={market.title}
/>
```

## 安全建议

### 1. API 密钥保护

- ✅ 使用环境变量存储 API 密钥
- ✅ 不要在前端暴露敏感信息
- ✅ 定期轮换 API 密钥

### 2. CORS 配置

```python
# 生产环境限制 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://your-domain.vercel.app",
        "https://your-custom-domain.com"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

### 3. 速率限制

```python
# 添加速率限制中间件
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.get("/monitoring/accounts/{address}")
@limiter.limit("10/minute")
async def get_account_summary(address: str):
    # ...
```

## 支持联系

如遇到部署问题，请：

1. 查看 [GitHub Issues](https://github.com/mstrcapital/polyalphascan/issues)
2. 查看 Vercel 部署日志
3. 检查后端 API 日志
4. 联系开发团队

---

**部署检查**: 确保所有步骤完成后再推送到生产环境  
**最后更新**: 2026-02-13
