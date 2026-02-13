# Polyalphascan 优化指南

本文档说明如何启用和配置新增的性能优化功能。

## 一、并行 LLM 处理

### 启用方法

修改 `backend/core/runner.py` 或相关的 pipeline 文件：

```python
# 原始导入
# from core.steps.implications import extract_implications

# 替换为并行版本
from core.steps.implications_parallel import extract_implications_parallel

# 在 pipeline 中使用
async def run_pipeline():
    groups = load_groups()
    
    # 并行处理，最多 5 个并发请求
    implications = await extract_implications_parallel(
        groups, 
        max_concurrent=5
    )
```

### 配置参数

在 `backend/core/steps/implications_parallel.py` 中调整：

```python
# 最大并发 LLM 请求数
MAX_CONCURRENT_REQUESTS = 5  # 根据 OpenRouter 限制调整

# 批处理大小
BATCH_SIZE = 10  # 每批处理的 groups 数量
```

### 性能提升

- **预期提升**: 5-10x
- **前提条件**: OpenRouter API 支持并发请求
- **注意事项**: 并发数过高可能触发速率限制

## 二、多 WebSocket 连接

### 启用方法

修改 `backend/server/main.py`：

```python
# 原始导入
# from server.price_aggregation import price_aggregation

# 替换为多连接版本
from server.price_aggregation_multi_ws import multi_ws_price_aggregation as price_aggregation

# 其余代码保持不变
```

### 配置参数

在 `backend/server/price_aggregation_multi_ws.py` 中调整：

```python
MAX_TOKENS_PER_CONNECTION = 500  # Polymarket 单连接限制
MAX_WEBSOCKET_CONNECTIONS = 10   # 安全限制
```

### 性能提升

- **预期提升**: 支持无限 tokens 订阅
- **原限制**: 单连接 500 tokens
- **新能力**: 自动创建多个连接处理所有 tokens

## 三、增量更新策略

### 实现方法

修改 `backend/core/market_poller.py`：

```python
class MarketPoller:
    def __init__(self):
        self._last_fetch_time: datetime = None
        self._known_event_ids: Set[str] = set()
    
    async def poll_new_events(self):
        """仅获取新增事件"""
        params = {
            "active": "true",
            "closed": "false"
        }
        
        if self._last_fetch_time:
            # 仅获取上次之后的事件
            params["created_after"] = self._last_fetch_time.isoformat()
        
        events = await fetch_events_with_params(params)
        
        # 过滤已知事件
        new_events = [
            e for e in events 
            if e["id"] not in self._known_event_ids
        ]
        
        # 更新状态
        self._last_fetch_time = datetime.now()
        self._known_event_ids.update(e["id"] for e in new_events)
        
        return new_events
```

### 性能提升

- **预期提升**: 减少 80-90% 的处理量
- **适用场景**: 轮询模式下的增量更新

## 四、环境变量配置

### 新增配置项

在 `.env` 文件中添加：

```bash
# =============================================================================
# 性能优化配置
# =============================================================================

# LLM 并行处理
LLM_MAX_CONCURRENT=5          # 最大并发 LLM 请求数
LLM_BATCH_SIZE=10             # 批处理大小

# WebSocket 优化
WS_MAX_CONNECTIONS=10         # 最大 WebSocket 连接数
WS_TOKENS_PER_CONNECTION=500  # 每连接 token 数限制

# 轮询优化
POLL_INTERVAL_SECONDS=30      # 轮询间隔（秒）
ENABLE_INCREMENTAL_UPDATE=true # 启用增量更新

# 缓存配置
ENABLE_REDIS_CACHE=false      # 启用 Redis 缓存（需要 Redis 服务）
REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=3600        # 缓存过期时间
```

## 五、性能监控

### 查看性能指标

访问新的监控 endpoint：

```bash
curl http://localhost:8000/monitoring/performance
```

返回示例：

```json
{
  "pipeline": {
    "last_run": "2026-02-13T13:00:00Z",
    "duration": 45.2,
    "events_processed": 150,
    "portfolios_found": 1250,
    "avg_llm_latency": 1.2,
    "websocket_connections": 3,
    "websocket_subscriptions": 1350
  },
  "cache": {
    "hit_rate": 0.85,
    "size": 500,
    "evictions": 12
  }
}
```

## 六、逐步启用建议

### Phase 1: 基础优化（立即启用）

1. ✅ 启用多 WebSocket 连接
2. ✅ 调整轮询间隔到 30 秒
3. ✅ 启用新的 Markets 和 Monitoring 页面

### Phase 2: 并行处理（测试后启用）

1. ⏭️ 在测试环境启用并行 LLM 处理
2. ⏭️ 监控 OpenRouter API 使用量和成本
3. ⏭️ 根据实际情况调整并发数

### Phase 3: 高级优化（可选）

1. ⏭️ 部署 Redis 并启用缓存
2. ⏭️ 实现增量更新策略
3. ⏭️ 添加性能监控仪表板

## 七、故障排查

### 问题 1: LLM 并发请求失败

**症状**: 出现大量 429 (Too Many Requests) 错误

**解决方案**:
```python
# 降低并发数
MAX_CONCURRENT_REQUESTS = 3  # 从 5 降到 3
```

### 问题 2: WebSocket 连接被拒绝

**症状**: 多个 WebSocket 连接失败

**解决方案**:
```python
# 减少最大连接数
MAX_WEBSOCKET_CONNECTIONS = 5  # 从 10 降到 5
```

### 问题 3: 内存使用过高

**症状**: 服务器内存占用持续增长

**解决方案**:
```python
# 减少批处理大小
BATCH_SIZE = 5  # 从 10 降到 5

# 限制价格队列大小
PRICE_QUEUE_MAX_SIZE = 5000  # 从 10000 降到 5000
```

## 八、性能基准测试

### 优化前

| 指标 | 数值 |
|------|------|
| Pipeline 运行时间 | ~5 分钟 |
| 处理 150 groups | 5 分钟 |
| WebSocket 订阅限制 | 500 tokens |
| 轮询效率 | 100% 数据处理 |

### 优化后（预期）

| 指标 | 数值 | 提升 |
|------|------|------|
| Pipeline 运行时间 | ~30 秒 | 10x |
| 处理 150 groups | 30 秒 | 10x |
| WebSocket 订阅限制 | 无限制 | ∞ |
| 轮询效率 | 10% 数据处理 | 10x |

## 九、成本考虑

### LLM API 成本

并行处理会增加 API 调用频率，但不会增加总调用次数。

**优化前**: 150 groups × 1 次调用 = 150 次调用  
**优化后**: 150 groups × 1 次调用 = 150 次调用（并行执行）

**结论**: 成本不变，仅速度提升。

### 基础设施成本

- **WebSocket 连接**: 可能略微增加网络流量
- **Redis 缓存**: 需要额外的 Redis 服务（可选）
- **内存使用**: 并行处理可能增加 10-20% 内存使用

## 十、推荐配置

### 小规模部署（< 100 portfolios）

```bash
LLM_MAX_CONCURRENT=3
WS_MAX_CONNECTIONS=2
POLL_INTERVAL_SECONDS=60
ENABLE_REDIS_CACHE=false
```

### 中等规模部署（100-500 portfolios）

```bash
LLM_MAX_CONCURRENT=5
WS_MAX_CONNECTIONS=5
POLL_INTERVAL_SECONDS=30
ENABLE_REDIS_CACHE=false
```

### 大规模部署（> 500 portfolios）

```bash
LLM_MAX_CONCURRENT=10
WS_MAX_CONNECTIONS=10
POLL_INTERVAL_SECONDS=30
ENABLE_REDIS_CACHE=true
REDIS_URL=redis://localhost:6379
```

## 十一、联系支持

如遇到问题，请查看：

1. 日志文件: `backend/logs/`
2. API 文档: `http://localhost:8000/docs`
3. GitHub Issues: [项目仓库]

---

**最后更新**: 2026-02-13  
**版本**: 1.0
