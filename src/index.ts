import 'dotenv/config';
import express from 'express';
import { verifyRouter } from './verify';

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
  console.log(`[SERVER] Health check: http://localhost:${PORT}/api/health`);
});
