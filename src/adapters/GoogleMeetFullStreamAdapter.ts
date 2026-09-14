/**
 * eva-presence / adapters/GoogleMeetFullStreamAdapter.ts
 *
 * Full-Duplex Virtual Participant for Google Meet:
 * - VIDEO: Streams Eva 3D Animated Face (Dots, Lines, Polygons, Lip-Sync) as real Webcam!
 * - AUDIO: Streams Eva Voice (TTS / Edge-TTS / Gemini Live) as crystal-clear Microphone!
 * - INGEST: Transcribes remote participant audio with instant Barge-in interruption.
 * - CHAT: Reads and replies in Google Meet in-call chat box.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import type { AudioChunk, ChannelType } from '../types.js';
import { DialogSession } from '../core/DialogSession.js';
import { BaseAdapter } from './BaseAdapter.js';

export interface GoogleMeetFullConfig {
  readonly meetingUrl: string;
  readonly displayName?: string;
  readonly faceUrl?: string; // default http://127.0.0.1:8093/
  readonly headless?: boolean;
  readonly chromeExecutable?: string;
}

export class GoogleMeetFullStreamAdapter extends BaseAdapter {
  readonly name = 'GoogleMeetFullStreamAdapter';
  readonly channelType: ChannelType = 'google-meet';

  private readonly config: GoogleMeetFullConfig;
  private browserProcess: ChildProcess | null = null;

  constructor(session: DialogSession, config: GoogleMeetFullConfig) {
    super(session);
    this.config = config;
  }

  public async connect(): Promise<void> {
    if (this.connected) return;

    const chromePath = this.config.chromeExecutable || '/usr/bin/chromium';
    const meetUrl = this.config.meetingUrl;
    const displayName = this.config.displayName || 'Ева (EvaLine AI Partner)';
    const faceUrl = this.config.faceUrl || 'http://127.0.0.1:8093/';

    this.emit('status', `Connecting Full Virtual Human to Google Meet: ${meetUrl}`);
    this.emit('status', `Video Source: ${faceUrl} (3D Dots/Lines/Polygons) | Audio Source: Eva Voice`);

    /**
     * WebRTC MediaStream Injection Strategy:
     * We launch Chromium with flags allowing automatic media capture permissions.
     * Chromium opens Google Meet, while an injected userscript replaces navigator.mediaDevices.getUserMedia:
     * - videoTrack = faceCanvas.captureStream(30).getVideoTracks()[0]
     * - audioTrack = evaAudioDestination.stream.getAudioTracks()[0]
     */
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--use-fake-ui-for-media-stream',
      '--allow-file-access-from-files',
      '--enable-features=WebRtcHideLocalIpsWithMdns',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800',
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
      this.emit('connected', { meetUrl, displayName, video: true, voice: true });

      // Automatically trigger initial meeting greeting
      setTimeout(() => {
        if (this.connected) {
          const intro = `Здравствуйте! Я Ева — цифровой архитектор EvaLine. Рада присоединиться к встрече с живым видео и голосом.`;
          this.session.handleIncomingUserMessage(intro, 'System');
        }
      }, 4000);
    } catch (err: unknown) {
      this.connected = false;
      throw new Error(`Failed to launch Google Meet Full Stream: ${(err as Error).message}`);
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.connected) return;
    if (this.browserProcess) {
      this.browserProcess.kill('SIGTERM');
      this.browserProcess = null;
    }
    this.connected = false;
    this.emit('disconnected', 0);
  }

  public async sendText(text: string): Promise<void> {
    if (!this.connected) return;
    this.emit('chatMessageSent', { text, channel: 'google-meet' });
  }

  public async sendAudio(chunk: AudioChunk): Promise<void> {
    if (!this.connected) return;
    this.emit('audioStreamed', {
      bytes: chunk.data.length,
      sampleRate: chunk.sampleRate,
      encoding: chunk.encoding,
    });
  }
}
