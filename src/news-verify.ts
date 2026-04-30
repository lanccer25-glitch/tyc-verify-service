import {
  resolveEndpoint, PENDING_ENDPOINTS, EndpointKey,
} from './type-mapping';
import {
  queryBidding, queryPatent, queryInvestment,
  queryCourtAnnouncement, queryCourtNotice, queryZhixing,
  queryRestriction, queryDishonest,
  queryImportExport, queryCustomer, queryPurchaser, queryLicense,
} from './tyc-endpoints';
import { matchBidding } from './matchers/bidding';
import { matchPatent } from './matchers/patent';
import { matchInvestment } from './matchers/investment';
import { matchJudicial } from './matchers/judicial';
import { matchImportExport } from './matchers/import-export';
import { matchCustomer } from './matchers/customer';
import { matchLicense } from './matchers/license';
import { queryBaseInfo, TycBaseInfo } from './tyc-api';

export interface VerifyReport {
  status: '已核实' | '无法验证' | '已核实（仅主体）' | '已识别（待接入）';
  usedEndpoint: string;
  resolvedEndpoint?: EndpointKey | 'unknown';
  items: number;
  matchedItem?: any;
  reason: string;
  hint?: string;
  baseinfo?: TycBaseInfo;
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

export async function verifyNews(
  companyName: string,
  dynamicType: string,
  newsText: string,
): Promise<VerifyReport> {
  const baseinfoPromise = queryBaseInfo(companyName).catch(() => undefined);
  const endpoint = resolveEndpoint(dynamicType);

  // 未识别
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

  // 已识别但接口未接入（Phase 2 后应为空）
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

  switch (endpoint) {
    // ---------- Phase 1 ----------
    case 'bidding': {
      const { items } = await queryBidding(companyName);
      return wrap('open/m/bids/2.0', endpoint, items,
        matchBidding(newsText, items), await baseinfoPromise);
    }
    case 'patent': {
      const { items } = await queryPatent(companyName);
      return wrap('open/ipr/patents/3.0', endpoint, items,
        matchPatent(newsText, items), await baseinfoPromise);
    }
    case 'investment': {
      const { items } = await queryInvestment(companyName);
      return wrap('open/ic/companyinvest/2.0', endpoint, items,
        matchInvestment(newsText, items), await baseinfoPromise);
    }

    // ---------- Phase 2：司法 5 子类 ----------
    case 'judicial_announcement': {
      const { items } = await queryCourtAnnouncement(companyName);
      return wrap('open/hi/announcement/2.0', endpoint, items,
        matchJudicial(newsText, items, 'announcement'), await baseinfoPromise);
    }
    case 'judicial_court_notice': {
      const { items } = await queryCourtNotice(companyName);
      return wrap('open/jr/courtNotice/2.0', endpoint, items,
        matchJudicial(newsText, items, 'court_notice'), await baseinfoPromise);
    }
    case 'judicial_zhixing': {
      const { items } = await queryZhixing(companyName);
      return wrap('open/jr/zhixing/2.0', endpoint, items,
        matchJudicial(newsText, items, 'zhixing'), await baseinfoPromise);
    }
    case 'judicial_restriction': {
      const { items } = await queryRestriction(companyName);
      return wrap('open/jr/consumptionRestriction/2.0', endpoint, items,
        matchJudicial(newsText, items, 'restriction'), await baseinfoPromise);
    }
    case 'judicial_dishonest': {
      const { items } = await queryDishonest(companyName);
      return wrap('open/jr/dishonest/2.0', endpoint, items,
        matchJudicial(newsText, items, 'dishonest'), await baseinfoPromise);
    }

    // ---------- Phase 2：其他 ----------
    case 'import_export': {
      const { items } = await queryImportExport(companyName);
      return wrap('open/ic/importAndExport/2.0', endpoint, items,
        matchImportExport(newsText, items), await baseinfoPromise);
    }
    case 'customer_client': {
      const { items } = await queryCustomer(companyName);
      return wrap('open/m/customer/2.0', endpoint, items,
        matchCustomer(newsText, items, 'client'), await baseinfoPromise);
    }
    case 'customer_supplier': {
      const { items } = await queryPurchaser(companyName);
      return wrap('open/m/purchaserList/2.0', endpoint, items,
        matchCustomer(newsText, items, 'supplier'), await baseinfoPromise);
    }
    case 'license': {
      const { items } = await queryLicense(companyName);
      return wrap('open/ic/license/2.0', endpoint, items,
        matchLicense(newsText, items), await baseinfoPromise);
    }

    // ---------- 兜底 ----------
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
