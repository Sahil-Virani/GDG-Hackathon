import express from 'express';
import path from 'node:path';
import { app, store, cleanupLimits } from './app.js';
import { config } from './config.js';
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve('dist/client')));
  app.get('/{*path}', (_req, res) => res.sendFile(path.resolve('dist/client/index.html')));
}
const timer = setInterval(() => {
  store.tick();
  cleanupLimits();
}, 1000);
timer.unref();
const server = app.listen(config.PORT, '0.0.0.0', (error?: Error) => {
  if (error) {
    console.error(`Could not start the API on port ${config.PORT}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Who Mogs Who API on http://localhost:${config.PORT} · ${config.demo ? 'DEMO AI' : 'LIVE AI'} · ${config.videoEnabled ? 'VONAGE VIDEO' : 'LOCAL CAMERA ONLY'}`,
  );
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    clearInterval(timer);
    server.close(() => process.exit(0));
  });
