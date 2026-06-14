// ============================================================
// 动态类型 → 天眼查 API endpoint
// 2026-04-21 Phase 2：judicial 拆 5 个子类，customer 拆 client/supplier
// PENDING_ENDPOINTS 清空（全部接口已接入）
// ============================================================

export type EndpointKey =
  | 'bidding'
  | 'patent'
  | 'investment'
  | 'investment_history'
  | 'judicial_announcement'   // 开庭
  | 'judicial_court_notice'   // 法院公告 / 裁判文书 / 送达
  | 'judicial_zhixing'        // 被执行
  | 'judicial_restriction'    // 限高
  | 'judicial_dishonest'      // 失信
  | 'import_export'
  | 'customer_client'
  | 'customer_supplier'
  | 'license'
  | 'punishment'
  | 'taxCredit'
  | 'personnel'
  | 'shareholder'
  | 'baseinfo';

/** Layer 1：精确查表（基于 2026-04-17 生产数据 23 枚举） */
export const TYPE_TO_ENDPOINT: Record<string, EndpointKey> = {
  // 招投标
  '新增招投标': 'bidding',

  // 专利
  '公开发明公布': 'patent',

  // 对外投资 / 股权
  '新增对外投资': 'investment',
  '退出对外投资': 'investment_history',

  // 司法（细分）
  '新增开庭公告':           'judicial_announcement',
  '被列入被执行人':         'judicial_zhixing',
  '被限制高消费':           'judicial_restriction',
  '被列入失信被执行人':     'judicial_dishonest',
  '新增送达公告':           'judicial_court_notice',
  '新增法院公告-裁判文书公告':      'judicial_court_notice',
  '新增法院公告-起诉状副本及开庭传票': 'judicial_court_notice',

  // 进出口
  '新增进出口信用': 'import_export',

  // 客户/供应商
  '新增客户':   'customer_client',
  '新增供应商': 'customer_supplier',

  // 行政许可
  '新增行政许可': 'license',

  // 行政处罚
  '行政处罚': 'punishment',

  // 税务评级
  '新增税务评级': 'taxCredit',

  // 人员变更
  '主要人员变更': 'personnel',

  // 股东/股权
  '新增股东': 'shareholder',
  '股东变更': 'shareholder',
  '股权变更': 'shareholder',
  '持股比例上升': 'shareholder',
  '持股比例下降': 'shareholder',

  // 主体变更类（baseinfo 兜底）
  '企业地址变更':   'baseinfo',
  '注册资本增加':   'baseinfo',
  '经营范围变更':   'baseinfo',
  '企业类型变更':   'baseinfo',
  '法定代表人变更': 'baseinfo',
  '新增相关公告':   'baseinfo',
};

/** Layer 2：正则兜底。顺序敏感，前面优先。 */
const FALLBACK_PATTERNS: Array<[RegExp, EndpointKey]> = [
  // 司法前缀（新类型出现时也能命中）
  [/^新增法院公告/,        'judicial_court_notice'],
  [/开庭/,                 'judicial_announcement'],
  [/限高|限制高消费/,      'judicial_restriction'],
  [/失信/,                 'judicial_dishonest'],
  [/执行|被执行/,          'judicial_zhixing'],
  [/送达公告|裁判文书|起诉|违法/, 'judicial_court_notice'],

  // 招投标
  [/招投标|中标|采购|招标|投标/, 'bidding'],

  // 专利
  [/专利|发明|实用新型|外观设计/, 'patent'],

  // 对外投资 / 股权
  [/退出对外|退出投资/, 'investment_history'],
  [/对外投资|股东|入股|控股|参股|持股比例/, 'investment'],

  // 客户/供应商
  [/供应商/, 'customer_supplier'],
  [/客户/,   'customer_client'],

  // 进出口
  [/进出口/, 'import_export'],

  // 行政许可
  [/行政许可/, 'license'],

  // 行政处罚
  [/行政处罚/, 'punishment'],

  // 人员变更
  [/人员变更|董监高|高管变更|任职|法人变更|法定代表人变更/, 'personnel'],

  // 股东/股权
  [/股东|股权|出资/, 'shareholder'],

  // 主体变更（最终兜底）
  [/变更|注销|吊销|增加|减少/, 'baseinfo'],
];

/** Phase 2 完成后清空 —— 所有已识别类型都有真实接口可调 */
export const PENDING_ENDPOINTS = new Set<EndpointKey>();

export function resolveEndpoint(dynamicType: string): EndpointKey | null {
  if (!dynamicType) return null;
  if (TYPE_TO_ENDPOINT[dynamicType]) return TYPE_TO_ENDPOINT[dynamicType];
  for (const [pattern, endpoint] of FALLBACK_PATTERNS) {
    if (pattern.test(dynamicType)) return endpoint;
  }
  return null;
}
