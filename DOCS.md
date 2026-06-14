# tyc-verify-service 完整文档

> 生成时间: 2026-04-30  
> 最后更新: 2026-05-12 — 人员变更切换 hi_members 历史接口 / 限高字段映射 & subtype 条件表头 / 司法多字段补全  
> 服务器: 腾讯云 CVM (106.55.150.191)  
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
    judicial.ts       <- 司法匹配+格式化（5个子类，多字段双映射，subtype 条件表头，限高专属格式）
    import-export.ts  <- 进出口匹配+格式化
    customer.ts       <- 客户/供应商匹配+格式化
    license.ts        <- 行政许可匹配+格式化
    personnel.ts      <- 人员变更匹配+格式化（基于 hi_members 历史记录，区分新增/退出/法定代表人变更）
    shareholder.ts    <- 股东/股权匹配+格式化（股东名/持股比例比对）
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

| 中文动态类型 | API key | 对应端点 | 有详情块 |
|-------------|---------|---------|---------|
| 新增招投标 | bidding | open/m/bids/2.0 | YES |
| 公开发明公布 | patent | open/ipr/patents/3.0 | YES |
| 新增对外投资/持股比例上升/下降 | investment | open/ic/inverst/2.0 | YES（含反向排查） |
| 退出对外投资 | investment_history | open/hi/invest/2.0 | YES（含退出时间） |
| 新增开庭公告 | judicial_announcement | open/jr/ktannouncement/2.0 | YES |
| 新增法院公告/裁判文书/起诉状副本/送达 | judicial_court_notice | open/jr/courtAnnouncement/2.0 | YES |
| 被列入被执行人 | judicial_zhixing | open/jr/zhixinginfo/2.0 | YES |
| 被限制高消费 | judicial_restriction | open/jr/consumptionRestriction/2.0 | YES |
| 被列入失信被执行人 | judicial_dishonest | open/jr/dishonest/2.0 | YES |
| 新增进出口信用 | import_export | open/m/importAndExport/2.0 | YES |
| 新增客户 | customer_client | open/m/customer/2.0 | YES |
| 新增供应商 | customer_supplier | open/m/supply/2.0 | YES |
| 新增行政许可 | license | open/m/getLicense/2.0 | YES |
| 新增税务评级 | taxCredit | open/m/taxCredit/2.0 | YES (通用格式化) |
| 主要人员变更 | personnel | open/hi/members | YES（变更历史表：姓名/日期/变更类型） |
| 新增股东/股东变更/股权变更 | shareholder | open/ic/holder/2.0 | YES（股东名+持股比例+日期） |
| 企业地址/注册资本/经营范围/类型/法定代表人/相关公告变更 | baseinfo | open/ic/baseinfo/normal | 仅主体 |

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

### 6.2 司法字段映射 — 2026-05-12 更新

`courtAnnouncement`、`ktannouncement`、`consumptionRestriction` 等接口字段名不统一（大小写/命名差异）。`matchJudicial` 和 `formatJudicialBlocks` 均做多字段映射：

| 列 | 匹配字段 |
|----|---------|
| 标题 | `title`, `bltntypename`, `caseReason`, `reason`, `partyInfo`, `xname` |
| 案号 | 优先从 `content` 正则提取 `(2025)冀0391民初1110号` 格式；回退 `caseCode` / `caseno` / `caseNo` |
| 公告编号 | `bltnno` |
| 法院/机关 | `courtcode`, `court`, `courtName`, `execCourtName`, `applicant` |
| 日期 | `publishdate`, `publishDate`, `startDate`, `caseCreateTime`, `regDate`（`pickDate` 函数自动转 YYYY-MM-DD） |
| 内容摘要 | `content`, `qyinfo` 前 80 字 |

**限制高消费 (restriction) 专属表头**：`formatJudicialBlocks` 根据 `subtype` 参数条件切换表头。
- `restriction`: 5 列 `被限人 | 案号 | 申请人 | 日期 | 内容`，`xname`→被限人，`applicant`→申请人，`qyinfo`+`amountInvolved`→内容
- 其他司法类: 6 列 `标题 | 案号 | 公告编号 | 法院/机关 | 日期 | 内容摘要`

**特别说明**：`bltnno` 是天眼查公告编号（非法院案号），案号需从 `content` 正文提取。API 的 `caseno` 字段通常为空。限制高消费接口不返回 `bltnno` 和法院字段，`applicant` 实为申请执行人（债权人）。

### 6.3 主要人员变更 (personnel) — 2026-05-12 重写

- **2026-05-12 重写**: 从 `open/ic/staff/2.0`（当前全员快照）切换为 `open/hi/members`（历史变更记录）
- 匹配: 在 `pastStafferList`（人员变更）和 `pastLegalPersonList`（法定代表人变更）中搜索新闻提及的人名
- 详情表格: `🔄 人员变更历史` | 姓名 | 日期 | 变更类型（人员新增/变更、人员退出、法定代表人变更） |
- 变更类型判断: `toco != null` → 人员退出，`type === 'legal'` → 法定代表人变更，其他 → 人员新增/变更
- 修正前问题: 原 `staff` 接口只返回当前全员名单，无法验证"变更"语义，展示也偏离用户预期

### 6.4 股东/股权变更 (shareholder) — 2026-05-06 新增

- 接口: `open/ic/holder/2.0` (key: `holder`)
- 匹配: 遍历股东列表，比对股东名称/持股比例是否出现在新闻中
- 详情表格: `📊 股东信息` | 股东名称 | 持股比例 | 认缴额 | 持股日期(ftShareholding) |
- 状态: 匹配到股东名/比例 → `已核实`；否则 `无法验证`

### 6.5 核实结果标红 — 2026-05-06 新增

`verify.ts` 中 `buildReportBlocks` 函数：当 `VerifyReport.status` 以"无法"或"已识别"开头时，`🔍 核实结果：` 标题以红色显示。

### 6.6 时间处理
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
