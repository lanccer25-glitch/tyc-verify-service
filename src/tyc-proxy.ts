import {
  callEndpoint,
  callEndpointByPath,
  getAllEndpoints,
  EndpointError,
} from './tyc-endpoints';
import { TycResponse, getRateLimitUsage } from './tyc-api';

export type { TycResponse };

export interface ProxyResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  missingParams?: string[];
}

export async function proxyCall<T = any>(
  key: string,
  params: Record<string, string | number | undefined> = {},
): Promise<ProxyResult<TycResponse<T>>> {
  try {
    const data = await callEndpoint<T>(key, params);
    return { success: true, data };
  } catch (err: any) {
    console.error(`[PROXY] ${key} failed:`, err.message);
    if (err instanceof EndpointError) {
      return { success: false, error: err.message, missingParams: err.missingParams };
    }
    return { success: false, error: err.message };
  }
}

export async function proxyCallByPath<T = any>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<ProxyResult<TycResponse<T>>> {
  try {
    const data = await callEndpointByPath<T>(path, params);
    return { success: true, data };
  } catch (err: any) {
    console.error(`[PROXY] ${path} failed:`, err.message);
    return { success: false, error: err.message };
  }
}

export function getProxyStatus() {
  const endpoints = getAllEndpoints();
  return {
    registeredEndpoints: endpoints.length,
    endpoints: endpoints.map((e) => ({
      key: e.key,
      path: e.path,
      description: e.description,
      required: e.required,
    })),
    rateLimit: getRateLimitUsage(),
  };
}
