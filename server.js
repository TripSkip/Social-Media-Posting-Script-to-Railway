const http = require('http');
const { runPublish, showStatus } = require('./publish');

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

function authorize(req) {
  if (!WEBHOOK_SECRET) return true;
  const auth = req.headers['authorization'] || '';
  return auth === `Bearer ${WEBHOOK_SECRET}`;
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (!authorize(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  // Health check
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'tripskip-publisher' }));
    return;
  }

  // Publish endpoint - n8n calls this
  if (req.url === '/publish' && req.method === 'POST') {
    const body = await parseBody(req);
    const dryRun = body.dryRun === true;
    console.log(`[${new Date().toISOString()}] /publish called (dryRun: ${dryRun})`);
    try {
      const result = await runPublish(dryRun);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...result }));
    } catch (e) {
      console.error('Publish error:', e.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // Status endpoint
  if (req.url === '/status' && req.method === 'GET') {
    console.log(`[${new Date().toISOString()}] /status called`);
    try {
      const result = await showStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...result }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`TripSkip Publisher running on port ${PORT}`);
});
