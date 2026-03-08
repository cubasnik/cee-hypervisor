const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  // Proxy common backend endpoints to the backend service inside Docker
  // This will proxy REST API, websockets and console/vnc endpoints while
  // leaving SPA routes (e.g. /vms) to be handled by the dev server.
  const proxyPaths = [
    '/api',
    '/socket.io',
    '/novnc',
    '/noVNC',
    '/console'
  ];

  // Choose proxy target from env (useful when running in WSL vs Docker)
  const proxyTarget = process.env.REACT_APP_PROXY_TARGET || process.env.REACT_APP_API_URL || 'http://localhost:8080';

  app.use(
    createProxyMiddleware(proxyPaths, {
      target: proxyTarget,
      changeOrigin: true,
      ws: true,
      secure: false,
      logLevel: 'info'
    })
  );
};
