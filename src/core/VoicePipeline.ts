/**
 * eva-presence / core/VoicePipeline.ts
 * Audio streaming, chunking, Voice Activity Detection (VAD) and format bridges.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { AudioChunk } from '../types.js';

const execFileAsync = promisify(execFile);

export interface VadOptions {
  energyThreshold?: number; // RMS energy threshold
  silenceDurationMs?: number; // silence to consider speech ended
}

export class VadDetector {
  private readonly threshold: number;
  private readonly silenceDurationMs: number;
  private isSpeaking = false;
  private lastVoiceTimestamp = 0;

  constructor(options: VadOptions = {}) {
    this.threshold = options.energyThreshold ?? 0.015;
    this.silenceDurationMs = options.silenceDurationMs ?? 800;
  }

  /**
   * Process 16-bit PCM buffer and detect if user is talking.
   */
  public processPcm16Chunk(chunk: Buffer): { isSpeaking: boolean; event?: 'start' | 'end' } {
    if (chunk.length === 0) return { isSpeaking: this.isSpeaking };

    // Calculate Root Mean Square (RMS) energy of 16-bit PCM samples
    let sumSquares = 0;
    const sampleCount = Math.floor(chunk.length / 2);
    for (let i = 0; i < chunk.length; i += 2) {
      const sample = chunk.readInt16LE(i) / 32768.0;
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / sampleCount);
    const now = Date.now();

    if (rms > this.threshold) {
      this.lastVoiceTimestamp = now;
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        return { isSpeaking: true, event: 'start' };
      }
      return { isSpeaking: true };
    }

    if (this.isSpeaking && (now - this.lastVoiceTimestamp > this.silenceDurationMs)) {
      this.isSpeaking = false;
      return { isSpeaking: false, event: 'end' };
    }

    return { isSpeaking: this.isSpeaking };
  }

  public reset(): void {
    this.isSpeaking = false;
    this.lastVoiceTimestamp = 0;
  }
}

export class VoicePipeline {
  /**
   * Convert arbitrary audio buffer (e.g. mp3/wav) to raw PCM 16kHz mono using local ffmpeg.
   */
  public static async convertToPcm16(inputBuffer: Buffer): Promise<Buffer> {
    const tmpInput = path.join(os.tmpdir(), `in_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`);
    const tmpOutput = path.join(os.tmpdir(), `out_${Date.now()}_${Math.random().toString(36).slice(2)}.pcm`);

    try {
      await fs.writeFile(tmpInput, inputBuffer);
      await execFileAsync('ffmpeg', [
        '-y',
        '-i', tmpInput,
        '-f', 's16le',
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        tmpOutput,
      ]);
      return await fs.readFile(tmpOutput);
    } catch {
      return Buffer.alloc(0);
    } finally {
      await fs.unlink(tmpInput).catch(() => {});
      await fs.unlink(tmpOutput).catch(() => {});
    }
  }

  /**
   * Convert MP3 or PCM to OGG Opus (ideal for Telegram Voice Notes).
   */
  public static async convertToOggOpus(inputBuffer: Buffer): Promise<Buffer> {
    const tmpInput = path.join(os.tmpdir(), `in_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`);
    const tmpOutput = path.join(os.tmpdir(), `out_${Date.now()}_${Math.random().toString(36).slice(2)}.ogg`);

    try {
      await fs.writeFile(tmpInput, inputBuffer);
      await execFileAsync('ffmpeg', [
        '-y',
        '-i', tmpInput,
        '-c:a', 'libopus',
        '-b:a', '32k',
        '-vbr', 'on',
        tmpOutput,
      ]);
      return await fs.readFile(tmpOutput);
    } catch {
      return Buffer.alloc(0);
    } finally {
      await fs.unlink(tmpInput).catch(() => {});
      await fs.unlink(tmpOutput).catch(() => {});
    }
  }
}
