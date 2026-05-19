import axios from 'axios';

const TYC_BASE =
  process.env.TYC_OPEN_API_BASE || 'http://open.api.tianyancha.com';
const TYC_TOKEN = process.env.TYC_OPEN_API_TOKEN || '';

const RATE_LIMIT = 200;
const WINDOW_MS = 60 * 60 * 1000;
let callTimestamps: number[] = [];

function checkRateLimit(): void {
  const now = Date.now();
  callTimestamps = callTimestamps.filter((t) => now - t < WINDOW_MS);
  if (callTimestamps.length >= RATE_LIMIT) {
    throw new Error(
      `[TYC_API] 限流：过去 1 小时已调用 ${RATE_LIMIT} 次，请稍后重试`,
    );
  }
  callTimestamps.push(now);
}

export function getRateLimitUsage(): { used: number; limit: number } {
  const now = Date.now();
  callTimestamps = callTimestamps.filter((t) => now - t < WINDOW_MS);
  return { used: callTimestamps.length, limit: RATE_LIMIT };
}

export interface TycResponse<T = any> {
  error_code: number;
  reason: string;
  result: T | null;
}

export async function tycRequest<T = any>(
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<TycResponse<T>> {
  checkRateLimit();
  const url = `${TYC_BASE}/services/${path}`;
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
  );

  console.log(`[TYC_API] GET ${path}`, cleanParams);
  const t0 = Date.now();

  try {
    const { data } = await axios.get<TycResponse<T>>(url, {
      params: cleanParams,
      headers: { Authorization: TYC_TOKEN },
      timeout: 15000,
    });
    const ms = Date.now() - t0;
    console.log(
      `[TYC_API] <- ${path} ${ms}ms error_code=${data.error_code}`,
    );
    return data;
  } catch (err: any) {
    console.error(`[TYC_API] ERR ${path}: ${err.message}`);
    throw err;
  }
}

export interface TycBaseInfo {
  name: string;
  regStatus: string;
  creditCode: string;
  legalPersonName: string;
  regCapital: string;
  estiblishTime: number;
  regLocation: string;
  staffNumRange: string;
  industry: string;
  businessScope: string;
  bondName?: string;
  bondNum?: string;
  historyNameList?: string[];
  taxNumber?: string;
  companyOrgType?: string;
  actualCapital?: string;
  [key: string]: unknown;
}

export async function queryBaseInfo(keyword: string) {
  const data = await tycRequest<TycBaseInfo>('open/ic/baseinfo/normal', {
    keyword,
  });
  if (data.error_code !== 0) {
    throw new Error(
      `[baseinfo] error_code=${data.error_code}, reason=${data.reason}`,
    );
  }
  return data.result!;
}
