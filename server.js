const http = require('http');
const { runPublish, showStatus } = require('./publish');

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

let lastResult = null;
let isRunning = false;

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
  // Health check - no auth required
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'tripskip-publisher', isRunning, lastResult }));
    return;
  }

  if (!authorize(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  // Publish endpoint - responds immediately, runs in background
  if (req.url === '/publish' && req.method === 'POST') {
    if (isRunning) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Publish already in progress' }));
      return;
    }

    const body = await parseBody(req);
    const dryRun = body.dryRun === true;
    console.log(`[${new Date().toISOString()}] /publish called (dryRun: ${dryRun})`);

    // Respond immediately
    isRunning = true;
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Publish started', dryRun }));

    // Run in background
    try {
      const result = await runPublish(dryRun);
      lastResult = { ...result, completedAt: new Date().toISOString() };
      console.log(`[${new Date().toISOString()}] Publish complete:`, JSON.stringify(lastResult));
    } catch (e) {
      lastResult = { error: e.message, completedAt: new Date().toISOString() };
      console.error('Publish error:', e.message);
    } finally {
      isRunning = false;
    }
    return;
  }

  // Status endpoint
  if (req.url === '/status' && req.method === 'GET') {
    console.log(`[${new Date().toISOString()}] /status called`);
    try {
      const result = await showStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, isRunning, lastResult, ...result }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // Last result endpoint - no auth required
  if (req.url === '/last-result' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ isRunning, lastResult }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`TripSkip Publisher running on port ${PORT}`);
});
