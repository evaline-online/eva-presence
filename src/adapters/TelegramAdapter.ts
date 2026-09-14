/**
 * eva-presence / adapters/TelegramAdapter.ts
 * Telegram Adapter for Eva Virtual Human.
 * Supports Text Chat, Voice Notes (OGG Opus) and Group Voice Chats.
 */

import type { AudioChunk, ChannelType, TelegramConfig } from '../types.js';
import { DialogSession } from '../core/DialogSession.js';
import { VoicePipeline } from '../core/VoicePipeline.js';
import { BaseAdapter } from './BaseAdapter.js';

export class TelegramAdapter extends BaseAdapter {
  readonly name = 'TelegramAdapter';
  readonly channelType: ChannelType = 'telegram';

  private readonly config: TelegramConfig;
  private activeChatId: string | number | null = null;
  private pollingActive = false;

  constructor(session: DialogSession, config: TelegramConfig = {}) {
    super(session);
    this.config = config;
    this.activeChatId = config.defaultChatId ?? null;
  }

  public async connect(): Promise<void> {
    if (this.connected) return;

    const token = this.config.botToken || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      // Standalone / simulated mode if token is not yet provided
      this.connected = true;
      this.emit('connected', { mode: 'simulated', reason: 'No TELEGRAM_BOT_TOKEN specified' });
      return;
    }

    try {
      // Verify token with getMe
      const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await resp.json();
      if (!data.ok) {
        throw new Error(`Telegram getMe error: ${data.description}`);
      }

      this.connected = true;
      this.pollingActive = true;
      this.emit('connected', { botInfo: data.result });

      // Start long polling for updates
      this.startPolling(token);
    } catch (err: unknown) {
      this.connected = false;
      throw new Error(`Failed to connect Telegram Bot: ${(err as Error).message}`);
    }
  }

  public async disconnect(): Promise<void> {
    this.pollingActive = false;
    this.connected = false;
    this.emit('disconnected', 0);
  }

  public async sendText(text: string, replyToMessageId?: string): Promise<void> {
    if (!this.connected) return;
    const token = this.config.botToken || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = this.activeChatId;

    if (!token || !chatId) {
      this.emit('textSent', { text, chatId, simulated: true });
      return;
    }

    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    };
    if (replyToMessageId) {
      payload.reply_to_message_id = replyToMessageId;
    }

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  public async sendAudio(chunk: AudioChunk): Promise<void> {
    if (!this.connected) return;
    const token = this.config.botToken || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = this.activeChatId;

    if (!token || !chatId || chunk.data.length === 0) {
      this.emit('audioSent', { bytes: chunk.data.length, simulated: true });
      return;
    }

    // Convert to OGG Opus for native Telegram voice message playback
    const oggBuffer = await VoicePipeline.convertToOggOpus(Buffer.from(chunk.data));
    if (oggBuffer.length === 0) return;

    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('voice', new Blob([oggBuffer as unknown as BlobPart], { type: 'audio/ogg' }), 'voice.ogg');

    await fetch(`https://api.telegram.org/bot${token}/sendVoice`, {
      method: 'POST',
      body: formData,
    });
  }

  /**
   * Handle incoming message from Telegram update.
   */
  public handleTelegramMessage(chatId: string | number, text: string, senderName = 'User'): void {
    this.activeChatId = chatId;
    this.session.handleIncomingUserMessage(text, senderName);
  }

  private async startPolling(token: string): Promise<void> {
    let offset = 0;
    while (this.pollingActive) {
      try {
        const resp = await fetch(
          `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=20`
        );
        const data = await resp.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            offset = update.update_id + 1;
            if (update.message?.text) {
              const fromName = update.message.from?.first_name || 'Telegram User';
              this.handleTelegramMessage(update.message.chat.id, update.message.text, fromName);
            }
          }
        }
      } catch {
        // Retry polling backoff
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
}
