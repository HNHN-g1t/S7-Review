// Local confirmation server for environments where file watching repeatedly restarts Vite.
const path = require('node:path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const { createServer } = await import('vite');
  const server = await createServer({
    root, configFile: path.join(root, 'vite.config.ts'),
    server: { host: '127.0.0.1', port: 5180, strictPort: true, watch: null, hmr: false },
  });
  await server.listen();
  server.printUrls();
  console.log('http://127.0.0.1:5180/review.html');
})().catch(error => { console.error(error); process.exitCode = 1; });
