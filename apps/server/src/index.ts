import { loadConfig } from './config.ts';
import { createApp } from './app.ts';

const config = loadConfig();
const { server } = createApp(config);

server.listen(config.port, config.host, () => {
  console.log(`[fitzen-api] listening on http://${config.host}:${config.port}`);
  if (!process.env.FITZEN_JWT_SECRET) {
    console.warn('[fitzen-api] FITZEN_JWT_SECRET not set — using an ephemeral dev secret.');
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[fitzen-api] ANTHROPIC_API_KEY not set — AI briefs use the deterministic engine.');
  }
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
