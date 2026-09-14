/**
 * eva-presence / adapters/UniversalWsAdapter.ts
 * Universal WebSocket & JSON adapter to embed Eva virtual human into ANY application.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { AudioChunk, ChannelType, UniversalWsConfig } from '../types.js';
import { DialogSession } from '../core/DialogSession.js';
import { BaseAdapter } from './BaseAdapter.js';

export class UniversalWsAdapter extends BaseAdapter {
  readonly name = 'UniversalWsAdapter';
  readonly channelType: ChannelType = 'universal-ws';

  private readonly config: UniversalWsConfig;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  constructor(session: DialogSession, config: UniversalWsConfig = {}) {
    super(session);
    this.config = config;
  }

  public async connect(): Promise<void> {
    if (this.connected) return;

    const port = this.config.port || 8095;
    const host = this.config.host || '0.0.0.0';

    this.wss = new WebSocketServer({ port, host });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);

      // Send initial state & persona info
      ws.send(JSON.stringify({
        type: 'ready',
        persona: this.session.getPersona(),
        state: this.session.getState(),
      }));

      ws.on('message', (raw: Buffer | string) => {
        try {
          const data = JSON.parse(raw.toString());
          this.handleClientPayload(ws, data);
        } catch (err: unknown) {
          ws.send(JSON.stringify({ type: 'error', message: (err as Error).message }));
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });
    });

    this.connected = true;
    this.emit('connected', { port, host });
  }

  public async disconnect(): Promise<void> {
    if (!this.connected) return;
    for (const ws of this.clients) {
      ws.close();
    }
    this.clients.clear();
    this.wss?.close();
    this.wss = null;
    this.connected = false;
    this.emit('disconnected', 0);
  }

  public async sendText(text: string): Promise<void> {
    const payload = JSON.stringify({
      type: 'text',
      sender: this.session.getPersona().name,
      text,
      timestamp: Date.now(),
    });
    this.broadcast(payload);
  }

  public async sendAudio(chunk: AudioChunk): Promise<void> {
    const payload = JSON.stringify({
      type: 'audio',
      audioBase64: Buffer.from(chunk.data).toString('base64'),
      encoding: chunk.encoding,
      sampleRate: chunk.sampleRate,
      timestamp: chunk.timestamp,
    });
    this.broadcast(payload);
  }

  private broadcast(payload: string): void {
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  private handleClientPayload(ws: WebSocket, data: Record<string, unknown>): void {
    const type = data.type;

    if (type === 'text' && typeof data.text === 'string') {
      const sender = typeof data.sender === 'string' ? data.sender : 'User';
      this.session.handleIncomingUserMessage(data.text, sender);
    } else if (type === 'speech_start') {
      this.session.handleParticipantSpeechStart();
    } else if (type === 'transcript' && typeof data.text === 'string') {
      const speaker = typeof data.speaker === 'string' ? data.speaker : 'User';
      const isFinal = Boolean(data.isFinal);
      this.session.handleTranscript(speaker, data.text, isFinal);
    } else if (type === 'interrupt') {
      this.session.interrupt('Client explicit interruption');
    }
  }
}
