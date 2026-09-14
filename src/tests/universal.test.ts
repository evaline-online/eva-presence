/**
 * eva-presence / tests/universal.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DialogSession } from '../core/DialogSession.js';
import { UniversalWsAdapter } from '../adapters/UniversalWsAdapter.js';
import { EvalineChatPlugin } from '../adapters/EvalineChatPlugin.js';

describe('Adapters & Plugin tests', () => {
  it('should initialize UniversalWsAdapter cleanly', async () => {
    const session = new DialogSession({ persona: 'eva' });
    const adapter = new UniversalWsAdapter(session, { port: 19876 });
    assert.equal(adapter.isConnected(), false);
    await adapter.connect();
    assert.equal(adapter.isConnected(), true);
    await adapter.disconnect();
    assert.equal(adapter.isConnected(), false);
  });

  it('should implement EvalineChatPlugin contract', async () => {
    const plugin = new EvalineChatPlugin();
    assert.equal(plugin.manifest.id, 'eva-presence');
    assert.equal(plugin.manifest.enabled, true);

    const commands: Record<string, Function> = {};
    const routes: Record<string, Function> = {};

    await plugin.initialize({
      registerCommand(name, handler) {
        commands[name] = handler;
      },
      registerRoute(method, path, handler) {
        routes[`${method} ${path}`] = handler;
      },
    });

    assert.ok(commands['/meet']);
    assert.ok(commands['/voice']);
    assert.ok(routes['GET /presence/status']);

    const meetRes = await commands['/meet']('https://meet.google.com/test-meet');
    assert.match(meetRes, /Google Meet/);

    const health = await plugin.healthCheck();
    assert.equal(health.status, 'healthy');
  });
});
