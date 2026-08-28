import http from 'node:http';

// Standalone script used by the Dockerfile HEALTHCHECK instruction. Kept
// dependency-free (no express/pino imports) so it stays cheap to run every
// few seconds inside the container.
const port = Number(process.env.PORT ?? 8080);

const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 2000 }, (res) => {
  process.exit(res.statusCode === 200 ? 0 : 1);
});

req.on('error', () => process.exit(1));
req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});
