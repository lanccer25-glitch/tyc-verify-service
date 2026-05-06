import {
  resolveEndpoint, PENDING_ENDPOINTS, EndpointKey,
} from './type-mapping';
import { callEndpoint, getEndpointPath } from './tyc-endpoints';
import { matchBidding, formatBiddingBlocks } from './matchers/bidding';
import { matchPatent, formatPatentBlocks } from './matchers/patent';
import { matchInvestment, formatInvestmentBlocks, matchInvestmentHistory, formatInvestmentHistoryBlocks } from './matchers/investment';
import { matchJudicial, formatJudicialBlocks } from './matchers/judicial';
import { matchImportExport, formatImportExportBlocks } from './matchers/import-export';
import { matchCustomer, formatCustomerBlocks } from './matchers/customer';
import { matchLicense, formatLicenseBlocks } from './matchers/license';
import { matchPersonnel, formatPersonnelBlocks } from './matchers/personnel';
import { queryBaseInfo, TycBaseInfo } from './tyc-api';
import { formatUniversalBlocks } from './matchers/universal';

export interface VerifyReport {
  status: '已核实' | '无法验证' | '已核实（仅主体）' | '已识别（待接入）';
  usedEndpoint: string;
  resolvedEndpoint?: EndpointKey | 'unknown';
  items: number;
  matchedItem?: any;
  reason: string;
  hint?: string;
  baseinfo?: TycBaseInfo;
  detailBlocks?: any[];
}

function endpointPath(key: EndpointKey | string): string {
  return getEndpointPath(key) ?? key;
}

function wrap(
  usedEndpoint: string,
  resolvedEndpoint: EndpointKey,
  items: any[],
  m: { matched: boolean; matchedItem?: any; reason: string; hint?: string },
  baseinfo: TycBaseInfo | undefined,
): VerifyReport {
  return {
    status: m.matched ? '已核实' : '无法验证',
    usedEndpoint,
    resolvedEndpoint,
    items: items.length,
    matchedItem: m.matchedItem,
    reason: m.reason,
    hint: m.hint,
    baseinfo,
  };
}

async function fetchItems(endpointKey: string, keyword: string) {
  try {
    const data = await callEndpoint(endpointKey, { keyword, pageNum: 1, pageSize: 20 });
    if (data.error_code !== 0) {
      console.warn(`[VERIFY] ${endpointKey} error_code=${data.error_code}: ${data.reason}`);
      return [] as any[];
    }
    const result = data.result as any;
    if (!result) return [];
    return result.items ?? [];
  } catch (err: any) {
    console.warn(`[VERIFY] ${endpointKey} failed:`, err.message);
    return [];
  }
}

async function fetchItemsWithParam(endpointKey: string, paramName: string, value: string) {
  try {
    const data = await callEndpoint(endpointKey, { [paramName]: value, pageNum: 1, pageSize: 20 });
    if (data.error_code !== 0) {
      console.warn(`[VERIFY] ${endpointKey} error_code=${data.error_code}: ${data.reason}`);
      return [] as any[];
    }
    const result = data.result as any;
    if (!result) return [];
    return result.items ?? [];
  } catch (err: any) {
    console.warn(`[VERIFY] ${endpointKey} failed:`, err.message);
    return [];
  }
}

export async function verifyNews(
  companyName: string,
  dynamicType: string,
  newsText: string,
): Promise<VerifyReport> {
  const baseinfoPromise = queryBaseInfo(companyName).catch(() => undefined);
  const endpoint = resolveEndpoint(dynamicType);

  if (!endpoint) {
    console.warn(`[VERIFY] 未识别动态类型: "${dynamicType}" → 回落 baseinfo`);
    const bi = await baseinfoPromise;
    return {
      status: bi ? '已核实（仅主体）' : '无法验证',
      usedEndpoint: 'open/ic/baseinfo/normal',
      resolvedEndpoint: 'unknown',
      items: bi ? 1 : 0,
      reason: `未识别动态类型「${dynamicType}」`,
      hint: '请在 type-mapping.ts 补充映射',
      baseinfo: bi,
    };
  }

  if (PENDING_ENDPOINTS.has(endpoint)) {
    const bi = await baseinfoPromise;
    return {
      status: '已识别（待接入）',
      usedEndpoint: 'open/ic/baseinfo/normal',
      resolvedEndpoint: endpoint,
      items: bi ? 1 : 0,
      reason: `类型「${dynamicType}」归类 ${endpoint}，专项接口未接入`,
      hint: `待接入: ${endpoint}`,
      baseinfo: bi,
    };
  }

  const path = endpointPath(endpoint);

  switch (endpoint) {
    case 'bidding': {
      const items = await fetchItems('bidding', companyName);
      const m = matchBidding(newsText, items);
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatBiddingBlocks(items) };
    }
    case 'patent': {
      const items = await fetchItems('patent', companyName);
      const m = matchPatent(newsText, items);
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatPatentBlocks(items) };
    }
    case 'investment': {
      const [items, historyItems] = await Promise.all([
        fetchItems('investment', companyName),
        fetchItems('investment_history', companyName).catch(() => []),
      ]);
      const m = matchInvestment(newsText, items, historyItems);
      const blocks = formatInvestmentBlocks(items);
      if ((m as any).exitedItems?.length) {
        blocks.push(...formatInvestmentHistoryBlocks((m as any).exitedItems));
      }
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: blocks };
    }
    case 'investment_history': {
      const items = await fetchItems('investment_history', companyName);
      const m = matchInvestmentHistory(newsText, items);
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatInvestmentHistoryBlocks(items) };
    }

    case 'judicial_announcement': {
      const items = await fetchItems('judicial_announcement', companyName);
      const m = matchJudicial(newsText, items, 'announcement');
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatJudicialBlocks(items) };
    }
    case 'judicial_court_notice': {
      const items = await fetchItems('judicial_court_notice', companyName);
      const m = matchJudicial(newsText, items, 'court_notice');
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatJudicialBlocks(items) };
    }
    case 'judicial_zhixing': {
      const items = await fetchItems('judicial_zhixing', companyName);
      const m = matchJudicial(newsText, items, 'zhixing');
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatJudicialBlocks(items) };
    }
    case 'judicial_restriction': {
      const items = await fetchItems('judicial_restriction', companyName);
      const m = matchJudicial(newsText, items, 'restriction');
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatJudicialBlocks(items) };
    }
    case 'judicial_dishonest': {
      const items = await fetchItems('judicial_dishonest', companyName);
      const m = matchJudicial(newsText, items, 'dishonest');
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatJudicialBlocks(items) };
    }

    case 'import_export': {
      const items = await fetchItems('import_export', companyName);
      const m = matchImportExport(newsText, items);
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatImportExportBlocks(items) };
    }
    case 'customer_client': {
      const items = await fetchItems('customer_client', companyName);
      const m = matchCustomer(newsText, items, 'client');
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatCustomerBlocks(items) };
    }
    case 'customer_supplier': {
      const items = await fetchItems('customer_supplier', companyName);
      const m = matchCustomer(newsText, items, 'supplier');
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatCustomerBlocks(items) };
    }
    case 'license': {
      const items = await fetchItems('license', companyName);
      const m = matchLicense(newsText, items);
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatLicenseBlocks(items) };
    }

    case 'taxCredit': {
      const items = await fetchItems('taxCredit', companyName);
      const m = { matched: items.length > 0, reason: `税务评级 ${items.length} 条记录`, matchedItem: items[0] };
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatUniversalBlocks(items) };
    }

    case 'personnel': {
      const items = await fetchItems('staff', companyName);
      const m = matchPersonnel(newsText, items);
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatPersonnelBlocks(items) };
    }

    case 'baseinfo': {
      const bi = await baseinfoPromise;
      return {
        status: bi ? '已核实（仅主体）' : '无法验证',
        usedEndpoint: 'open/ic/baseinfo/normal',
        resolvedEndpoint: endpoint,
        items: bi ? 1 : 0,
        reason: bi ? `主体变更类「${dynamicType}」，仅核实主体` : '主体查询失败',
        baseinfo: bi,
      };
    }
    default: {
      const bi = await baseinfoPromise;
      return {
        status: '无法验证',
        usedEndpoint: 'open/ic/baseinfo/normal',
        resolvedEndpoint: endpoint,
        items: 0,
        reason: '未处理的 endpoint',
        baseinfo: bi,
      };
    }
  }
}
