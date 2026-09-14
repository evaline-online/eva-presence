/**
 * eva-presence / server.ts
 * Standalone server runner for @evaline/presence.
 */

import http from 'node:http';
import { DialogSession } from './core/DialogSession.js';
import { UniversalWsAdapter } from './adapters/UniversalWsAdapter.js';

const PORT = Number(process.env.PRESENCE_PORT || 8095);
const HOST = process.env.PRESENCE_HOST || '0.0.0.0';

const session = new DialogSession({
  persona: 'eva',
  mode: 'duplex',
});

const wsAdapter = new UniversalWsAdapter(session, { port: PORT, host: HOST });

const httpServer = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', persona: session.getPersona().name, state: session.getState() }));
    return;
  }

  if (req.url === '/api/message' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const reply = await session.handleIncomingUserMessage(payload.text || '', payload.sender || 'User');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, reply }));
      } catch (err: unknown) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: (err as Error).message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// We listen on PORT + 1 for HTTP, or let ws handle WS on PORT
const HTTP_PORT = PORT + 1;
httpServer.listen(HTTP_PORT, HOST, async () => {
  await wsAdapter.connect();
  console.log(`[Eva Presence] WebSocket gateway: ws://${HOST}:${PORT}`);
  console.log(`[Eva Presence] HTTP control API:  http://${HOST}:${HTTP_PORT}`);
});
