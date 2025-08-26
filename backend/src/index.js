import express from 'express';
import morgan from 'morgan';
import fetch from 'cross-fetch';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  contentSecurityPolicy: false // frontend is separate; keep disabled here
}));
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*'}));
app.use(compression());
app.use(express.json({ limit: '256kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(rateLimit({ windowMs: 60 * 1000, max: 120 }));

const PORT = process.env.PORT || 4000;
const CONTRACT = process.env.CONTRACT_ADDRESS; // format: ST...::private-messaging
const [DEPLOYER, CONTRACT_NAME] = CONTRACT ? CONTRACT.split('::') : ['', ''];
const HIRO = process.env.HIRO_API_BASE || 'https://api.testnet.hiro.so';

if (!CONTRACT) {
  console.warn('WARNING: CONTRACT_ADDRESS not set. Set in .env to enable blockchain calls.');
}

// Simple health
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now(), version: process.env.APP_VERSION || 'dev', network: process.env.STACKS_NETWORK || 'testnet' }));

// Read-only helper: get profile
app.get('/api/profile/:principal', async (req, res) => {
  try {
    if (!CONTRACT) return res.status(500).json({ error: 'contract-not-configured' });
    const principal = req.params.principal;
    // Use Hiro read-only endpoint (POST body required) – fallback to call via clarity values would require more setup.
    // Here we just document; front-end should directly use @stacks/transactions for accuracy.
    return res.json({ note: 'Use front-end direct callReadOnlyFunction for real data', principal });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal', detail: e.message });
  }
});

// Fallback route
app.use((_, res) => res.status(404).json({ error: 'not-found' }));

app.listen(PORT, () => console.log(`PMA backend listening on :${PORT} (env=${process.env.NODE_ENV || 'dev'})`));
