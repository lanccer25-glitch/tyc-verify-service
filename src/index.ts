import 'dotenv/config';
import express from 'express';
import { verifyRouter } from './verify';
import { proxyCall, proxyCallByPath, getProxyStatus } from './tyc-proxy';
import { getAllEndpointKeys, getAllEndpoints } from './tyc-endpoints';

const app = express();
const PORT = process.env.PORT || 3100;

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'tyc-verify-service',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', verifyRouter);

// ============================================================
// 统一代理路由：所有调用走 endpoints.json 中注册的路径
// ============================================================

app.get('/api/proxy/status', (_req, res) => {
  res.json(getProxyStatus());
});

app.get('/api/proxy/endpoints', (_req, res) => {
  res.json({ count: getAllEndpointKeys().length, endpoints: getAllEndpoints() });
});

app.post('/api/proxy/:key', async (req, res) => {
  const { key } = req.params;
  const params = req.body || {};
  const result = await proxyCall(key, params);
  if (!result.success) {
    return res.status(404).json(result);
  }
  res.json(result);
});

app.post('/api/raw', async (req, res) => {
  const { path, params } = req.body || {};
  if (!path) {
    return res.status(400).json({ success: false, error: '缺少 path 参数' });
  }
  const result = await proxyCallByPath(path, params || {});
  if (!result.success) {
    return res.status(404).json(result);
  }
  res.json(result);
});

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error('[ERROR]', err.message, err.stack);
    res.status(500).json({ success: false, error: err.message });
  },
);

app.listen(PORT, () => {
  console.log(`[SERVER] tyc-verify-service running on :${PORT}`);
  console.log(`[SERVER] Health: http://localhost:${PORT}/api/health`);
  console.log(`[SERVER] Endpoints: ${getAllEndpointKeys().length} registered`);
});
