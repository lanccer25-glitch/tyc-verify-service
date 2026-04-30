# tyc-verify-service 完整文档

> 生成时间: 2026-04-30  
> 服务器: 腾讯云 Lighthouse (VM-8-13-opencloudos)  
> 运行端口: 3100  
> PM2 进程名: tyc-verify

---

## 1. 项目概述

天眼查 OpenAPI 代理服务，对接 Notion 实现企业动态自动核实。

核心功能: 从 Notion 获取企业名称+动态类型 -> 调天眼查 API -> 写回核实结果+详情。

---

## 2. 最终架构

```
src/
  endpoints.json      <- 接口路径配置（唯一需维护的文件）
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
    investment.ts     <- 投资匹配+格式化
    judicial.ts       <- 司法匹配+格式化（5个子类）
    import-export.ts  <- 进出口匹配+格式化
    customer.ts       <- 客户/供应商匹配+格式化
    license.ts        <- 行政许可匹配+格式化
    universal.ts      <- 通用格式化（自动检测数据结构）
```

---

## 3. API 路由

| 路由 | 方法 | 说明 |
|------|------|------|
| /api/health | GET | 健康检查 |
| /api/proxy/status | GET | 所有已注册端点+限流状态 |
| /api/proxy/:key | POST | 调已注册端点，自动校验参数 |
| /api/raw | POST | 调任意路径 {"path":"xxx","params":{}} |
| /api/verify-company | POST | Notion 核实触发 |

---

## 4. 如何添加新接口

编辑 /root/tyc-verify-service/src/endpoints.json：

```json
{
  "新接口key": {
    "path": "open/xx/yy/zz/2.0",
    "description": "接口描述",
    "required": ["keyword"]
  }
}
```

然后重启：
```bash
cd /root/tyc-verify-service && npm run build && pm2 restart tyc-verify
```

无需改任何其他代码。

---

## 5. Verify 流程支持的 13 种类型

| 中文动态类型 | API key | 有详情块 |
|-------------|---------|---------|
| 新增招投标 | bidding | YES |
| 公开发明公布 | patent | YES |
| 新增对外投资/退出/持股变化 | investment | YES |
| 新增开庭公告 | judicial_announcement | YES |
| 新增法院公告/裁判文书 | judicial_court_notice | YES |
| 被列入被执行人 | judicial_zhixing | YES |
| 被限制高消费 | judicial_restriction | YES |
| 被列入失信被执行人 | judicial_dishonest | YES |
| 新增进出口信用 | import_export | YES |
| 新增客户 | customer_client | YES |
| 新增供应商 | customer_supplier | YES |
| 新增行政许可 | license | YES |
| 主体变更类 | baseinfo | 仅主体 |

---

## 6. 常见问题

### error_code=300000
路径通，但该关键词无数据。

### error_code=300005
接口不在订阅范围或路径有误。

### Invalid time value
日期字段包含字符串，已修复 tsToDate 支持 string 类型。

### 关键字被截断
Notion 侧数据问题，公司名过长被截断。

### GitHub push/pull 超时
国内网络问题，手动更新文件。

### 限流
200次/小时，通过 /api/proxy/status 查看。

---

## 7. 常用命令

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

## 8. 环境变量

```
TYC_OPEN_API_BASE=https://open.api.tianyancha.com
TYC_OPEN_API_TOKEN=<your token>
NOTION_TOKEN=<your notion token>
PORT=3100
```
