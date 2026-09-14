/**
 * eva-presence / adapters/BaseAdapter.ts
 * Abstract base adapter coordinating DialogSession and platform communications.
 */

import { EventEmitter } from 'node:events';
import type { IPlatformAdapter, ChannelType, AudioChunk, ChatMessage } from '../types.js';
import { DialogSession } from '../core/DialogSession.js';

export abstract class BaseAdapter extends EventEmitter implements IPlatformAdapter {
  abstract readonly name: string;
  abstract readonly channelType: ChannelType;

  protected connected = false;
  protected readonly session: DialogSession;

  constructor(session: DialogSession) {
    super();
    this.session = session;

    // Pipe session messages and audio to adapter output
    this.session.on('messageGenerated', (msg: ChatMessage) => {
      if (this.connected) {
        this.sendText(msg.text).catch((err) => {
          this.emit('error', new Error(`Failed to send text: ${err.message}`));
        });
      }
    });

    this.session.on('audioChunkReady', (chunk: AudioChunk) => {
      if (this.connected) {
        this.sendAudio(chunk).catch((err) => {
          this.emit('error', new Error(`Failed to send audio: ${err.message}`));
        });
      }
    });
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getSession(): DialogSession {
    return this.session;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract sendText(text: string, replyToMessageId?: string): Promise<void>;
  abstract sendAudio(chunk: AudioChunk): Promise<void>;
}
