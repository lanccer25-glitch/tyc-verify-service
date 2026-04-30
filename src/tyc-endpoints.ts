import { tycRequest, TycResponse } from './tyc-api';
import endpointsConfig from './endpoints.json';

const endpoints: Record<string, string> = endpointsConfig;

export function getEndpointPath(key: string): string | undefined {
  return endpoints[key];
}

export function getAllEndpointKeys(): string[] {
  return Object.keys(endpoints);
}

export function getAllEndpoints(): Array<{ key: string; path: string }> {
  return Object.entries(endpoints).map(([key, path]) => ({ key, path }));
}

export function hasEndpoint(key: string): boolean {
  return key in endpoints;
}

export async function callEndpoint<T = any>(
  key: string,
  params: Record<string, string | number | undefined> = {},
): Promise<TycResponse<T>> {
  const path = endpoints[key];
  if (!path) {
    throw new Error(`[ENDPOINT] 未注册的端点: ${key}，请在 endpoints.json 中添加`);
  }
  return tycRequest<T>(path, params);
}

export async function callEndpointByPath<T = any>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<TycResponse<T>> {
  return tycRequest<T>(path, params);
}
