#!/bin/bash
# 测试对外投资 API 返回字段结构，重点查看是否有投资日期
# 用法: bash test-investment-response.sh [企业名]

KEYWORD="${1:-阿里巴巴}"
TOKEN="${TYC_OPEN_API_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "请设置 TYC_OPEN_API_TOKEN 环境变量"
  exit 1
fi

echo "=== 测试对外投资 API 返回字段 ==="
echo "keyword: ${KEYWORD}"
echo ""

# 1. 测试 open/ic/inverst/2.0（endpoints.json 中的路径）
echo "--- 路径1: open/ic/inverst/2.0 ---"
RESP=$(curl -s "https://open.api.tianyancha.com/services/open/ic/inverst/2.0?keyword=${KEYWORD}&pageNum=1&pageSize=3" \
  -H "Authorization: ${TOKEN}" --max-time 15 2>/dev/null)

echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"
echo ""

# 打印每个 item 的所有 key，方便发现未使用的字段
echo "--- 返回 item 的所有字段名 ---"
echo "$RESP" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    items = data.get('result', {}).get('items', [])
    if not items:
        print('无记录 (error_code=' + str(data.get('error_code', '?')) + ')')
    else:
        print(f'共 {len(items)} 条记录')
        print()
        for i, item in enumerate(items[:3]):
            print(f'--- 第{i+1}条 ---')
            for k, v in item.items():
                tv = str(v)[:80] if not isinstance(v, (dict, list)) else type(v).__name__
                print(f'  {k}: {tv}')
            print()
        # 检查所有时间相关字段
        all_keys = set()
        for item in items:
            all_keys.update(item.keys())
        time_keys = [k for k in sorted(all_keys) if any(t in k.lower() for t in ['time', 'date', 'day', '日', '时间'])]
        print(f'时间相关字段: {time_keys if time_keys else "(无)"}')
        print(f'全部字段: {sorted(all_keys)}')
except Exception as e:
    print(f'解析错误: {e}')
"

# 2. 也测试一下 open/ic/companyinvest/2.0（discover-tyc.sh 中的备选路径）
echo ""
echo "--- 路径2: open/ic/companyinvest/2.0 ---"
RESP2=$(curl -s "https://open.api.tianyancha.com/services/open/ic/companyinvest/2.0?keyword=${KEYWORD}&pageNum=1&pageSize=3" \
  -H "Authorization: ${TOKEN}" --max-time 15 2>/dev/null)
echo "$RESP2" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f'error_code={data.get(\"error_code\")}, items={len(data.get(\"result\",{}).get(\"items\",[]))} 条')
except: print('parse error')
"
