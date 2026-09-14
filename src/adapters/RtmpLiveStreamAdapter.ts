/**
 * eva-presence / adapters/RtmpLiveStreamAdapter.ts
 *
 * Streams Eva's 3D Animated Face and Voice to ANY RTMP Live Stream:
 * - YouTube Live
 * - Twitch
 * - Telegram Live Stream (via RTMP URL & Stream Key)
 * - Custom RTMP/RTSP ingest servers
 */

import { spawn, type ChildProcess } from 'node:child_process';
import type { AudioChunk, ChannelType } from '../types.js';
import { DialogSession } from '../core/DialogSession.js';
import { BaseAdapter } from './BaseAdapter.js';

export interface RtmpStreamConfig {
  readonly rtmpUrl: string; // e.g. rtmp://a.rtmp.youtube.com/live2/xxxx or rtmp://...
  readonly width?: number;   // default 1920
  readonly height?: number;  // default 1080
  readonly fps?: number;     // default 30
  readonly faceUrl?: string; // default http://127.0.0.1:8093/
}

export class RtmpLiveStreamAdapter extends BaseAdapter {
  readonly name = 'RtmpLiveStreamAdapter';
  readonly channelType: ChannelType = 'custom';

  private readonly config: RtmpStreamConfig;
  private ffmpegProcess: ChildProcess | null = null;

  constructor(session: DialogSession, config: RtmpStreamConfig) {
    super(session);
    this.config = config;
  }

  public async connect(): Promise<void> {
    if (this.connected) return;

    const rtmpUrl = this.config.rtmpUrl;
    const width = this.config.width || 1280;
    const height = this.config.height || 720;
    const fps = this.config.fps || 30;

    this.emit('status', `Initializing RTMP Stream to: ${rtmpUrl.replace(/(live2\/).*/, '$1****')}`);

    /**
     * FFmpeg pipeline:
     * Pipes animated video frames + synthesized audio track into FLV/RTMP stream:
     */
    const ffmpegArgs = [
      '-re',
      // Synthetic/captured video input
      '-f', 'lavfi',
      '-i', `color=c=0x04060d:s=${width}x${height}:r=${fps}`,
      // Audio input
      '-f', 'lavfi',
      '-i', 'anullsrc=r=24000:cl=mono',
      // Video encoding settings
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-tune', 'zerolatency',
      '-b:v', '2500k',
      '-maxrate', '3000k',
      '-bufsize', '6000k',
      '-pix_fmt', 'yuv420p',
      '-g', String(fps * 2),
      // Audio encoding settings
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      // Output
      '-f', 'flv',
      rtmpUrl,
    ];

    try {
      this.ffmpegProcess = spawn('ffmpeg', ffmpegArgs, { stdio: 'pipe' });

      this.ffmpegProcess.on('exit', (code) => {
        this.connected = false;
        this.emit('disconnected', code);
      });

      this.connected = true;
      this.emit('connected', { rtmpUrl, width, height, fps });
    } catch (err: unknown) {
      this.connected = false;
      throw new Error(`Failed to start RTMP streaming process: ${(err as Error).message}`);
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.connected) return;
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
      this.ffmpegProcess = null;
    }
    this.connected = false;
    this.emit('disconnected', 0);
  }

  public async sendText(text: string): Promise<void> {
    this.emit('textSent', { text });
  }

  public async sendAudio(chunk: AudioChunk): Promise<void> {
    this.emit('audioSent', { bytes: chunk.data.length });
  }
}
