import { tycRequest, TycResponse } from './tyc-api';
import endpointsConfig from './endpoints.json';

export interface EndpointDef {
  path: string;
  description?: string;
  required?: string[];
}

type EndpointValue = string | EndpointDef;
type EndpointsConfig = Record<string, EndpointValue>;

const config = endpointsConfig as EndpointsConfig;

function resolveDef(value: EndpointValue): EndpointDef {
  if (typeof value === 'string') {
    return { path: value };
  }
  return value;
}

export function getEndpointDef(key: string): EndpointDef | undefined {
  const raw = config[key];
  if (!raw) return undefined;
  return resolveDef(raw);
}

export function getEndpointPath(key: string): string | undefined {
  return getEndpointDef(key)?.path;
}

export function getAllEndpointKeys(): string[] {
  return Object.keys(config);
}

export function getAllEndpoints(): Array<{ key: string; path: string; description?: string; required?: string[] }> {
  return Object.entries(config).map(([key, raw]) => {
    const def = resolveDef(raw);
    return { key, path: def.path, description: def.description, required: def.required };
  });
}

export class EndpointError extends Error {
  constructor(
    message: string,
    public missingParams?: string[],
  ) {
    super(message);
    this.name = 'EndpointError';
  }
}

export async function callEndpoint<T = any>(
  key: string,
  params: Record<string, string | number | undefined> = {},
): Promise<TycResponse<T>> {
  const def = getEndpointDef(key);
  if (!def) {
    throw new EndpointError(`未注册的端点: ${key}，请在 endpoints.json 中添加`);
  }

  if (def.required) {
    const missing = def.required.filter((p) => {
      const v = params[p];
      return v === undefined || v === '' || v === null;
    });
    if (missing.length) {
      throw new EndpointError(
        `端点 ${key} 缺少必要参数: ${missing.join(', ')}`,
        missing,
      );
    }
  }

  return tycRequest<T>(def.path, params);
}

export async function callEndpointByPath<T = any>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<TycResponse<T>> {
  return tycRequest<T>(path, params);
}
