import { tycRequest } from './tyc-api';

export interface BiddingItem {
  title: string;
  abs: string;
  content?: string;
  proxyName?: string;
  purchaser?: string;
  publishTime: number;
  bidType?: string;
  bidIndustry?: string;
  projectCode?: string;
  bidAmount?: string;
  [key: string]: unknown;
}

export interface ListResult<T> {
  total: number;
  items: T[];
}

export async function queryBidding(keyword: string, pageSize = 20) {
  const data = await tycRequest<ListResult<BiddingItem>>('open/m/bids/2.0', {
    keyword,
    pageNum: 1,
    pageSize,
  });
  if (data.error_code !== 0)
    throw new Error(`[bids] ${data.error_code}: ${data.reason}`);
  return data.result ?? { total: 0, items: [] };
}

export interface PatentItem {
  patentName: string;
  applicantName?: string;
  appNumber?: string;
  pubNumber?: string;
  appDate?: number;
  pubDate?: number;
  patentType?: string;
  [key: string]: unknown;
}

export async function queryPatent(keyword: string, pageSize = 20) {
  const data = await tycRequest<ListResult<PatentItem>>(
    'open/ipr/patents/3.0',
    { keyword, pageNum: 1, pageSize },
  );
  if (data.error_code !== 0)
    throw new Error(`[patents] ${data.error_code}: ${data.reason}`);
  return data.result ?? { total: 0, items: [] };
}

export interface InvestmentItem {
  name: string;
  legalPersonName?: string;
  regCapital?: string;
  regStatus?: string;
  estiblishTime?: number;
  percent?: string;
  amount?: string;
  [key: string]: unknown;
}

export async function queryInvestment(keyword: string, pageSize = 20) {
  const data = await tycRequest<ListResult<InvestmentItem>>(
    'open/ic/inverst/2.0',
    { keyword, pageNum: 1, pageSize },
  );
  if (data.error_code !== 0)
    throw new Error(`[invest] ${data.error_code}: ${data.reason}`);
  return data.result ?? { total: 0, items: [] };
}

// ============================================================
// Phase 2 — 司法 / 进出口 / 客户 / 行政许可 接口
// 2026-04-21 新增，所有接口权限已开通
// ============================================================

// ---------- 司法类（5 个子接口） ----------
export async function queryCourtAnnouncement(keyword: string) {
  // 历史开庭公告
  const data = await tycRequest('open/hi/announcement/2.0', {
    keyword, pageNum: 1, pageSize: 20,
  });
  return { items: data?.items ?? [], total: data?.total ?? 0 };
}

export async function queryCourtNotice(keyword: string) {
  // 法院公告（裁判文书 / 起诉状 / 送达）
  const data = await tycRequest('open/jr/courtNotice/2.0', {
    keyword, pageNum: 1, pageSize: 20,
  });
  return { items: data?.items ?? [], total: data?.total ?? 0 };
}

export async function queryZhixing(keyword: string) {
  // 被执行人
  const data = await tycRequest('open/jr/zhixing/2.0', {
    keyword, pageNum: 1, pageSize: 20,
  });
  return { items: data?.items ?? [], total: data?.total ?? 0 };
}

export async function queryRestriction(keyword: string) {
  // 限制高消费
  const data = await tycRequest('open/jr/consumptionRestriction/2.0', {
    keyword, pageNum: 1, pageSize: 20,
  });
  return { items: data?.items ?? [], total: data?.total ?? 0 };
}

export async function queryDishonest(keyword: string) {
  // 失信被执行人（接口 ID 843）
  const data = await tycRequest('open/jr/dishonest/2.0', {
    keyword, pageNum: 1, pageSize: 20,
  });
  return { items: data?.items ?? [], total: data?.total ?? 0 };
}

// ---------- 进出口 ----------
export async function queryImportExport(keyword: string) {
  const data = await tycRequest('open/ic/importAndExport/2.0', { keyword });
  return { items: data?.items ?? [] };
}

// ---------- 客户 / 供应商 ----------
export async function queryCustomer(keyword: string) {
  // 企业客户（接口 ID 947）
  const data = await tycRequest('open/m/customer/2.0', {
    keyword, pageNum: 1, pageSize: 20,
  });
  return { items: data?.items ?? [] };
}

export async function queryPurchaser(keyword: string) {
  // 企业供应商
  const data = await tycRequest('open/m/purchaserList/2.0', {
    keyword, pageNum: 1, pageSize: 20,
  });
  return { items: data?.items ?? [] };
}

// ---------- 行政许可 ----------
export async function queryLicense(keyword: string) {
  const data = await tycRequest('open/ic/license/2.0', {
    keyword, pageNum: 1, pageSize: 20,
  });
  return { items: data?.items ?? [] };
}
