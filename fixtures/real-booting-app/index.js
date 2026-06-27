// A real, minimal HTTP server. Listens on PORT (env, default 3000).
// Responds 200 OK to any GET. Exits cleanly on SIGTERM.
const http = require('node:http');
const port = parseInt(process.env.PORT || '3000', 10);

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK\n');
});

server.listen(port, '127.0.0.1', () => {
  console.log('listening on http://127.0.0.1:' + port);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
