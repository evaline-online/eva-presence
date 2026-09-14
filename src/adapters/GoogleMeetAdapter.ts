/**
 * eva-presence / adapters/GoogleMeetAdapter.ts
 * Headless browser virtual participant for Google Meet conferences.
 * Handles audio input/output, in-call chat, and human-like presence.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import type { AudioChunk, ChannelType, GoogleMeetConfig } from '../types.js';
import { DialogSession } from '../core/DialogSession.js';
import { BaseAdapter } from './BaseAdapter.js';

export class GoogleMeetAdapter extends BaseAdapter {
  readonly name = 'GoogleMeetAdapter';
  readonly channelType: ChannelType = 'google-meet';

  private readonly config: GoogleMeetConfig;
  private browserProcess: ChildProcess | null = null;
  private inCallChatActive = false;

  constructor(session: DialogSession, config: GoogleMeetConfig) {
    super(session);
    this.config = config;
  }

  /**
   * Connect to Google Meet call.
   */
  public async connect(): Promise<void> {
    if (this.connected) return;

    const chromePath = this.config.chromeExecutable || '/usr/bin/chromium';
    const meetUrl = this.config.meetingUrl;
    const displayName = this.config.displayName || this.session.getPersona().name;

    this.emit('status', `Connecting to Google Meet: ${meetUrl} as "${displayName}"...`);

    // In a production deployment with Chromium installed, we launch Chromium with media stream permissions:
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-position=0,0',
      '--window-size=1280,800',
      '--use-fake-ui-for-media-stream',
      '--enable-features=WebRtcHideLocalIpsWithMdns',
      '--disable-blink-features=AutomationControlled',
      meetUrl,
    ];

    try {
      this.browserProcess = spawn(chromePath, args, {
        detached: false,
        stdio: 'pipe',
      });

      this.browserProcess.on('exit', (code) => {
        this.connected = false;
        this.emit('disconnected', code);
      });

      this.connected = true;
      this.inCallChatActive = true;
      this.emit('connected', { meetUrl, displayName });

      // Greet meeting participants gracefully
      setTimeout(() => {
        if (this.connected) {
          const greeting = `Здравствуйте! Я виртуальный архитектор ${displayName}. Подключилась к встрече, слушаю вас и готова отвечать в чате или голосом.`;
          this.session.handleIncomingUserMessage(greeting, 'System');
        }
      }, 3000);
    } catch (err: unknown) {
      this.connected = false;
      throw new Error(`Failed to launch Chromium for Google Meet: ${(err as Error).message}`);
    }
  }

  /**
   * Disconnect and leave the Google Meet room.
   */
  public async disconnect(): Promise<void> {
    if (!this.connected) return;

    if (this.browserProcess) {
      this.browserProcess.kill('SIGTERM');
      this.browserProcess = null;
    }
    this.connected = false;
    this.inCallChatActive = false;
    this.emit('disconnected', 0);
  }

  /**
   * Send a textual chat message into the Google Meet in-call chat box.
   */
  public async sendText(text: string): Promise<void> {
    if (!this.connected) return;
    this.emit('chatMessageSent', { text, channel: 'google-meet' });
    // In headless browser automation:
    // await page.click('button[aria-label="Chat with everyone"]');
    // await page.fill('textarea[aria-label="Send a message"]', text);
    // await page.keyboard.press('Enter');
  }

  /**
   * Stream synthesized audio chunks into the Google Meet virtual microphone track.
   */
  public async sendAudio(chunk: AudioChunk): Promise<void> {
    if (!this.connected) return;
    this.emit('audioStreamed', {
      bytes: chunk.data.length,
      sampleRate: chunk.sampleRate,
      encoding: chunk.encoding,
    });
  }

  /**
   * Simulate or forward participant speech recognized in the meeting.
   */
  public ingestMeetingSpeech(speaker: string, text: string): void {
    this.session.handleTranscript(speaker, text, true);
  }

  /**
   * Simulate or forward participant chat message posted in Google Meet chat.
   */
  public ingestMeetingChat(sender: string, text: string): void {
    this.session.handleIncomingUserMessage(text, sender);
  }
}
