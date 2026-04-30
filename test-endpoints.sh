#!/bin/sh
# 测试所有天眼查端点 — 兼容 sh/bash
# 用法: sh test-endpoints.sh

TOKEN="${1:-4e7e1a37-2c70-436f-ae66-990f1f25dabe}"
KEYWORD="腾讯"
BASE="http://open.api.tianyancha.com/services"

PASS=0
FAIL=0

test_one() {
  key="$1"
  path="$2"
  url="${BASE}/${path}?keyword=${KEYWORD}"
  
  resp=$(curl -s "$url" -H "Authorization: ${TOKEN}" --max-time 15 2>/dev/null)
  ec=$(echo "$resp" | grep -o '"error_code":[0-9]*' | grep -o '[0-9]*' | head -1)
  
  if [ "$ec" = "0" ] || [ "$ec" = "300000" ] || [ "$ec" = "200001" ]; then
    echo "OK   $key | $path | ec=$ec"
    PASS=$((PASS + 1))
  else
    echo "FAIL $key | $path | ec=${ec:-?}"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== 天眼查端点测试 ==="

test_one "baseinfo"                "open/ic/baseinfo/normal"
test_one "bidding"                 "open/m/bids/2.0"
test_one "patent"                  "open/ipr/patents/3.0"
test_one "investment"              "open/ic/companyinvest/2.0"
test_one "judicial_announcement"   "open/hi/announcement/2.0"
test_one "judicial_court_notice"   "open/jr/courtNotice/2.0"
test_one "judicial_zhixing"        "open/jr/zhixing/2.0"
test_one "judicial_restriction"    "open/jr/consumptionRestriction/2.0"
test_one "judicial_dishonest"      "open/jr/dishonest/2.0"
test_one "import_export"           "open/ic/importAndExport/2.0"
test_one "customer_client"         "open/m/customer/2.0"
test_one "customer_supplier"       "open/m/purchaserList/2.0"
test_one "license"                 "open/ic/license/2.0"

echo "=== 通过 $PASS / 失败 $FAIL ==="
