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
import { matchPunishment, formatPunishmentBlocks } from './matchers/punishment';
import { matchPersonnel, formatPersonnelBlocks } from './matchers/personnel';
import { matchShareholder, formatShareholderBlocks } from './matchers/shareholder';
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
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatJudicialBlocks(items, 'announcement') };
    }
    case 'judicial_court_notice': {
      const items = await fetchItems('judicial_court_notice', companyName);
      const m = matchJudicial(newsText, items, 'court_notice');
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatJudicialBlocks(items, 'court_notice') };
    }
    case 'judicial_zhixing': {
      const items = await fetchItems('judicial_zhixing', companyName);
      const m = matchJudicial(newsText, items, 'zhixing');
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatJudicialBlocks(items, 'zhixing') };
    }
    case 'judicial_restriction': {
      const items = await fetchItems('judicial_restriction', companyName);
      const m = matchJudicial(newsText, items, 'restriction');
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatJudicialBlocks(items, 'restriction') };
    }
    case 'judicial_dishonest': {
      const items = await fetchItems('judicial_dishonest', companyName);
      const m = matchJudicial(newsText, items, 'dishonest');
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatJudicialBlocks(items, 'dishonest') };
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

    case 'punishment': {
      const items = await fetchItems('punishment', companyName);
      const m = matchPunishment(newsText, items);
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatPunishmentBlocks(items) };
    }

    case 'taxCredit': {
      const items = await fetchItems('taxCredit', companyName);
      const m = { matched: items.length > 0, reason: `税务评级 ${items.length} 条记录`, matchedItem: items[0] };
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatUniversalBlocks(items) };
    }

    case 'personnel': {
      const resp = await callEndpoint('hi_members', { keyword: companyName });
      const result = (resp.error_code === 0 && resp.result) ? resp.result as any : {};
      const changes: any[] = [
        ...(result.pastStafferList || []).flat(),
        ...(result.pastLegalPersonList || []),
      ];
      const m = matchPersonnel(newsText, result);
      return { ...wrap(path, endpoint, changes, m, await baseinfoPromise), detailBlocks: formatPersonnelBlocks(result) };
    }

    case 'shareholder': {
      const items = await fetchItems('holderChange', companyName);
      const m = matchShareholder(newsText, items);
      return { ...wrap(path, endpoint, items, m, await baseinfoPromise), detailBlocks: formatShareholderBlocks(items) };
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
