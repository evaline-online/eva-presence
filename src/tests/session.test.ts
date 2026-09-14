/**
 * eva-presence / tests/session.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DialogSession } from '../core/DialogSession.js';

describe('DialogSession tests', () => {
  it('should initialize in IDLE state', () => {
    const session = new DialogSession({ persona: 'eva' });
    assert.equal(session.getState(), 'IDLE');
  });

  it('should switch state to LISTENING when speech starts', () => {
    const session = new DialogSession({ persona: 'eva' });
    session.handleParticipantSpeechStart();
    assert.equal(session.getState(), 'LISTENING');
  });

  it('should support barge-in interruption while speaking', () => {
    const session = new DialogSession({ persona: 'eva' });
    session.setState('SPEAKING');

    let interruptedCalled = false;
    session.on('interrupted', (reason) => {
      interruptedCalled = true;
      assert.match(reason, /Barge-in/);
    });

    session.handleParticipantSpeechStart();
    assert.ok(interruptedCalled);
    assert.equal(session.getState(), 'LISTENING');
  });

  it('should handle incoming message and store history', async () => {
    const session = new DialogSession({ persona: 'eva', mode: 'text' });
    const reply = await session.handleIncomingUserMessage('Привет!', 'Tester');

    assert.ok(reply);
    assert.equal(reply.isAgent, true);
    assert.ok(reply.text.length > 0);
    assert.equal(session.getHistory().length, 2);
  });
});
