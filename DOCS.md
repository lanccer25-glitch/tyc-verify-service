# tyc-verify-service 完整文档

> 生成时间: 2026-04-30  
> 最后更新: 2026-05-06 — 对外投资反向排查 & 退出投资接入  
> 服务器: 腾讯云 Lighthouse (VM-8-13-opencloudos)  
> 运行端口: 3100  
> PM2 进程名: tyc-verify

---

## 1. 项目概述

天眼查 OpenAPI 代理服务，对接 Notion 实现企业动态自动核实。

核心链路: Notion 按钮触发 -> 获取企业名称+动态类型 -> 调天眼查 API 核实 -> 写回核实结果+详情块

---

## 2. 最终架构

```
src/
  endpoints.json      <- 接口路径配置（唯一需维护的文件，201 个端点）
  tyc-api.ts          <- HTTP 客户端，200次/小时限流
  tyc-endpoints.ts    <- 读 endpoints.json，按 key 调接口
  tyc-proxy.ts        <- 统一代理层
  tyc-types.ts        <- 共享类型
  index.ts            <- Express 路由
  type-mapping.ts     <- 中文动态类型 -> API 映射 + 正则兜底
  news-verify.ts      <- 核实逻辑 + 详情块生成
  verify.ts           <- Notion 集成
  matchers/
    _util.ts          <- 文本匹配工具
    bidding.ts        <- 招投标匹配+格式化
    patent.ts         <- 专利匹配+格式化
    investment.ts     <- 投资匹配+格式化（含反向排查 & 历史退出）
    judicial.ts       <- 司法匹配+格式化（5个子类，多字段映射）
    import-export.ts  <- 进出口匹配+格式化
    customer.ts       <- 客户/供应商匹配+格式化
    license.ts        <- 行政许可匹配+格式化
    universal.ts      <- 通用格式化（自动检测数据结构生成表格）
```

---

## 3. API 路由

| 路由 | 方法 | 说明 |
|------|------|------|
| /api/health | GET | 健康检查 |
| /api/proxy/status | GET | 201个端点+限流状态 |
| /api/proxy/:key | POST | 调已注册端点，自动校验参数 |
| /api/raw | POST | 调任意路径 {"path":"xxx","params":{}} |
| /api/verify-company | POST | Notion 核实触发 |

---

## 4. 如何添加新接口

编辑 /root/tyc-verify-service/src/endpoints.json，添加一个 key：

```json
{
  "新接口key": {
    "path": "open/xx/yy/zz/2.0",
    "description": "接口描述",
    "required": ["keyword"]
  }
}
```

重启: `cd /root/tyc-verify-service && npm run build && pm2 restart tyc-verify`

### 4.1 如需新类型接入 Verify 流程（三步）

1. **endpoints.json** 加路径
2. **type-mapping.ts** 加 EndpointKey + TYPE_TO_ENDPOINT 映射
3. **news-verify.ts** 加 case（可用 `formatUniversalBlocks` 通用格式化）

示例（税务评级）:
```typescript
// type-mapping.ts
| 'taxCredit'  // 加到 EndpointKey 类型

'新增税务评级': 'taxCredit',  // 加到 TYPE_TO_ENDPOINT

// news-verify.ts
case 'taxCredit': {
  const items = await fetchItems('taxCredit', companyName);
  const m = { matched: items.length > 0, reason: '税务评级 ' + items.length + ' 条记录' };
  return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatUniversalBlocks(items) };
}
```

---

## 5. Verify 流程支持的类型

| 中文动态类型 | API key | 有详情块 |
|-------------|---------|---------|
| 新增招投标 | bidding | YES |
| 公开发明公布 | patent | YES |
| 新增对外投资/持股比例上升/下降 | investment | YES |
| 退出对外投资 | investment_history | YES（含退出时间） |
| 新增开庭公告 | judicial_announcement | YES |
| 新增法院公告/裁判文书/起诉状副本 | judicial_court_notice | YES |
| 被列入被执行人 | judicial_zhixing | YES |
| 被限制高消费 | judicial_restriction | YES |
| 被列入失信被执行人 | judicial_dishonest | YES |
| 新增进出口信用 | import_export | YES |
| 新增客户 | customer_client | YES |
| 新增供应商 | customer_supplier | YES |
| 新增行政许可 | license | YES |
| 新增税务评级 | taxCredit | YES (通用格式化) |
| 主体变更类 | baseinfo | 仅主体 |

---

## 6. 已知关键修正

### 6.1 对外投资 (investment + investment_history) — 2026-05-06 更新

对外投资核实拆分为两个独立端点：

| Key | 路径 | 用途 | 关键字段 |
|-----|------|------|---------|
| `investment` | `open/ic/inverst/2.0` | 新增对外投资、持股变化 | estiblishTime(成立日), percent(比例) |
| `investment_history` | `open/hi/invest/2.0` | 退出对外投资 | withdrawalTime(退出时间), percent(比例) |

**反向排查机制**：核实"新增对外投资"时，会并行调 `investment_history` 接口。如果命中的被投资企业在历史接口中存在 `withdrawalTime`，报告会标注 ⚠️ 警告（"该企业已于 XX日 退出"），并在详情块追加退出时间表格。

**已知限制**：
- `paidinTime`（实缴出资时间）始终为 null，无法获取实际投资日期
- `subscriptionTime`（认缴出资时间）仅为约定缴资截止日，非实际发生日期
- 投资事件类接口（`open/oi/investEvent/2.0` 等）当前账号无权限

### 6.2 司法字段映射
judicial.ts 的 `pick` 函数覆盖 5 种司法子类的所有字段变体:
- 标题: litigant, party1, pname, bltntypename, caseReason
- 案号: caseCode, caseno, caseNo, bltnno
- 法院: court, execCourtName, courtcode, courtName
- 日期: publishDate, publishdate, caseCreateTime, startDate
- 金额: execMoney, content

### 6.3 时间处理
tsToDate 已修复支持 number | string 类型，防止 Invalid time value

---

## 7. 常见问题

### error_code=300000
路径通但该关键词无数据，试其他企业名。

### error_code=300005
接口不在订阅范围或路径有误。

### 关键字被截断
Notion 侧公司名过长被截断（如"股份有限公司"变成"股份有限公司"），导致查不到。

### GitHub push/pull 超时
国内网络问题，可通过 git stash + pull 或手动更新文件。

### 限流
200次/小时，/api/proxy/status 查看 rateLimit.used。

---

## 8. 常用命令

```bash
# 编译重启
cd /root/tyc-verify-service && npm run build && pm2 restart tyc-verify

# 查看日志
pm2 logs tyc-verify --lines 10 --nostream

# 查看状态
curl http://localhost:3100/api/proxy/status

# 测试端点
curl -X POST http://localhost:3100/api/proxy/{key} -H "Content-Type: application/json" -d '{"keyword":"企业名"}'
```

---

## 9. 环境变量

```
TYC_OPEN_API_BASE=https://open.api.tianyancha.com
TYC_OPEN_API_TOKEN=<your token>
NOTION_TOKEN=<your notion token>
PORT=3100
```
