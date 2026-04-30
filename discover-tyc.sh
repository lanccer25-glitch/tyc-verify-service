#!/bin/bash
# 天眼查 API 自动发现脚本 — 在 Lighthouse 上运行
# 用法: bash discover-tyc.sh
# 输出: 可用的接口路径列表

TOKEN="4e7e1a37-2c70-436f-ae66-990f1f25dabe"
MCP_URL="https://ai-mcp.tianyancha.com/mcp"
BASE="https://open.api.tianyancha.com/services"
OUTDIR="/root/tyc-verify-service/discovery"
mkdir -p "$OUTDIR"

echo "=============================================="
echo "Step 1: 通过 MCP Server 获取工具列表"
echo "=============================================="

RESP=$(curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: $TOKEN" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"discover","version":"1.0"}}}' \
  --max-time 30 2>/dev/null)

SESSION=$(echo "$RESP" | grep -i 'mcp-session-id' | head -1 | sed 's/.*mcp-session-id: \([^\r\n]*\).*/\1/')

if [ -z "$SESSION" ]; then
  # 尝试从 body 解析，或者 SSE 格式
  SESSION=$(echo "$RESP" | grep -o '"mcp-session-id":[^,}]*' | grep -o '[^":]*$' | tr -d '"')
fi

echo "MCP Initialize response: $(echo "$RESP" | head -3)"
echo "Session: ${SESSION:-(not found)}"

if [ -n "$SESSION" ]; then
  echo ""
  echo "Step 2: 获取所有 tools/list"
  TOOLS=$(curl -s -X POST "$MCP_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: $TOKEN" \
    -H "Mcp-Session-Id: $SESSION" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
    --max-time 30 2>/dev/null)
  
  echo "$TOOLS" > "$OUTDIR/mcp-tools.json"
  TOOL_COUNT=$(echo "$TOOLS" | python3 -c "import sys,json; d=json.loads(sys.stdin.read().split('\n')[-1]); print(len(d.get('result',{}).get('tools',[])))" 2>/dev/null || echo "?")
  echo "MCP 工具数: $TOOL_COUNT"
fi

echo ""
echo "=============================================="
echo "Step 3: 抓取 API 文档接口列表"
echo "=============================================="

# 尝试抓文档站点的数据
for url in \
  "https://open.tianyancha.com/api/open/list" \
  "https://open.tianyancha.com/api/open/interface/page?pageSize=300" \
  "https://open.api.tianyancha.com/openapi/v1/catalog" \
  "https://open-tyc.tianyancha.com/api/v1/open-interfaces"; do
  echo "Trying: $url"
  curl -s "$url" --max-time 10 -o "$OUTDIR/doc-$(echo "$url" | md5sum | cut -c1-8).json" 2>/dev/null
  SIZE=$(wc -c < "$OUTDIR/doc-$(echo "$url" | md5sum | cut -c1-8).json" 2>/dev/null || echo 0)
  echo "  → ${SIZE} bytes"
done

echo ""
echo "=============================================="
echo "Step 4: 从 MCP 工具列表生成 endpoints.json 预填"
echo "=============================================="

python3 << 'PYEOF'
import json, sys

# 已确认的路径
known = {
    "baseinfo": "open/ic/baseinfo/normal",
    "baseinfo_v2": "open/ic/baseinfoV2/2.0",
    "baseinfo_v3": "open/ic/baseinfoV3/2.0",
    "baseinfo_special": "open/ic/baseinfo/special",
    "verify": "open/ic/verify/2.0",
    "company_type_v2": "open/ic/companyType/v2",
    "company_type": "open/ic/companyType",
    "snapshot": "open/ic/snapshot",
    "contact": "open/ic/contact",
    "staff": "open/ic/staff/2.0",
    "holder": "open/ic/holder/2.0",
    "hi_members": "open/hi/members",
    "law_suit": "open/jr/lawSuit/3.0",
    "law_suit_history": "open/hi/lawSuit/3.0",
    "law_suit_detail": "open/jr/lawSuit/detail",
    "ktannouncement": "open/jr/ktannouncement/2.0",
    "announcement_history": "open/hi/announcement/2.0",
    "court_announcement": "open/jr/courtAnnouncement/2.0",
    "court_history": "open/hi/court/2.0",
    "send_announcement": "open/jr/sendAnnouncement/2.0",
    "court_register": "open/jr/courtRegister/2.0",
    "judicial_assist": "v4/open/judicial",
    "judicial_assist_detail": "v4/open/getJudicialDetail",
    "hi_judicial": "open/hi/judicial/2.0",
    "hi_judicial_detail": "open/hi/judicial/detail/2.0",
    "bankruptcy": "open/jr/bankruptcy/2.0",
    "bankruptcy_detail": "open/jr/bankruptcy/detail/2.0",
    "zhixing": "open/jr/zhixinginfo/2.0",
    "zhixing_history": "open/hi/zhixing/2.0",
    "dishonest": "open/jr/dishonest/2.0",
    "dishonest_history": "open/hi/dishonest/2.0",
    "consumption_restriction": "open/jr/consumptionRestriction/2.0",
    "end_case": "open/jr/endCase/2.0",
    "judicial_case": "open/jr/judicialCase/2.0",
    "restricted_outbound": "open/jr/restrictedOutbound",
    "judicial_announcement": "open/jr/ktannouncement/2.0",
    "judicial_court_notice": "open/jr/courtAnnouncement/2.0",
    "judicial_zhixing": "open/jr/zhixinginfo/2.0",
    "judicial_restriction": "open/jr/consumptionRestriction/2.0",
    "judicial_dishonest": "open/jr/dishonest/2.0",
    "license": "open/m/getLicense/2.0",
    "recruitment": "open/m/employments/3.0",
    "bidding": "open/m/bids/2.0",
    "patent": "open/ipr/patents/3.0",
    "investment": "open/ic/companyinvest/2.0",
    "import_export": "open/ic/importAndExport/2.0",
    "customer_client": "open/m/customer/2.0",
    "customer_supplier": "open/m/purchaserList/2.0",
}

print(f"已记录 {len(known)} 个端点")
print(f"\n=== 待验证路径（旧代码继承）===")
pending = ["bidding","patent","investment","import_export","customer_client","customer_supplier"]
for k in pending:
    print(f"  {k}: {known[k]} ← 未在控制台确认")

print(f"\n确认数: {len(known) - len(pending)}")
print(f"待验证: {len(pending)}")
print(f"剩余: {239 - len(known)}")
PYEOF

echo ""
echo "=============================================="
echo "Done. 数据保存于 $OUTDIR/"
ls -la "$OUTDIR/"
echo "=============================================="
