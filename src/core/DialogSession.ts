/**
 * eva-presence / core/DialogSession.ts
 * Real-time conversation state machine with turn-taking and barge-in (interruption) handling.
 */

import { EventEmitter } from 'node:events';
import type { PresenceState, PresenceOptions, PersonaConfig, ChatMessage, AudioChunk } from '../types.js';
import { getPersona } from './EvaPersona.js';

export interface DialogSessionEvents {
  stateChanged: (state: PresenceState, previous: PresenceState) => void;
  messageGenerated: (message: ChatMessage) => void;
  audioChunkReady: (chunk: AudioChunk) => void;
  interrupted: (reason: string) => void;
  transcriptReceived: (speaker: string, text: string, isFinal: boolean) => void;
}

export class DialogSession extends EventEmitter {
  private state: PresenceState = 'IDLE';
  private readonly persona: PersonaConfig;
  private readonly options: PresenceOptions;
  private readonly history: ChatMessage[] = [];
  private currentAbortController: AbortController | null = null;
  private isProcessing = false;

  constructor(options: PresenceOptions = {}) {
    super();
    this.options = options;
    this.persona = getPersona(options.persona ?? 'eva');
  }

  public getState(): PresenceState {
    return this.state;
  }

  public getPersona(): PersonaConfig {
    return this.persona;
  }

  public getHistory(): readonly ChatMessage[] {
    return this.history;
  }

  public setState(newState: PresenceState): void {
    if (this.state === newState) return;
    const previous = this.state;
    this.state = newState;
    this.emit('stateChanged', newState, previous);
    this.options.onStateChange?.(newState, previous);
  }

  /**
   * Called when a human participant starts talking.
   * If Eva is currently speaking, this triggers immediate Barge-In interruption!
   */
  public handleParticipantSpeechStart(): void {
    if (this.state === 'SPEAKING' || this.state === 'THINKING') {
      this.interrupt('Participant started speaking (Barge-in)');
    }
    this.setState('LISTENING');
  }

  /**
   * Called when incoming transcript is received from STT.
   */
  public handleTranscript(speaker: string, text: string, isFinal: boolean): void {
    this.emit('transcriptReceived', speaker, text, isFinal);
    this.options.onTranscript?.(speaker, text, isFinal);

    if (isFinal && text.trim().length > 0) {
      this.handleIncomingUserMessage(text.trim(), speaker);
    }
  }

  /**
   * Handle an incoming textual user message (from in-call chat, Telegram, or STT).
   */
  public async handleIncomingUserMessage(text: string, sender = 'User'): Promise<ChatMessage | null> {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender,
      text,
      isAgent: false,
      timestamp: Date.now(),
      channel: 'custom',
    };
    this.history.push(userMsg);
    this.options.onChatMessage?.(userMsg);

    // If already speaking or thinking, abort previous generation
    if (this.state === 'SPEAKING' || this.state === 'THINKING') {
      this.interrupt('New incoming message superseded current speech');
    }

    return this.generateAgentReply(userMsg);
  }

  /**
   * Interrupt current speech / generation gracefully.
   */
  public interrupt(reason: string): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    const previous = this.state;
    this.setState('INTERRUPTED');
    this.emit('interrupted', reason);

    // Return to IDLE after interruption flush
    setTimeout(() => {
      if (this.state === 'INTERRUPTED') {
        this.setState('IDLE');
      }
    }, 150);
  }

  /**
   * Generate an agent reply using the Brain backend and optional Voice backend.
   */
  private async generateAgentReply(userMsg: ChatMessage): Promise<ChatMessage | null> {
    if (this.isProcessing) return null;
    this.isProcessing = true;
    this.setState('THINKING');

    const abortController = new AbortController();
    this.currentAbortController = abortController;

    try {
      // 1. Fetch LLM reply from local EvaBrain API (or fallback synthesis)
      const replyText = await this.callBrainApi(userMsg.text, abortController.signal);
      if (abortController.signal.aborted) return null;

      const agentMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: this.persona.name,
        text: replyText,
        isAgent: true,
        timestamp: Date.now(),
        channel: 'custom',
      };
      this.history.push(agentMsg);
      this.emit('messageGenerated', agentMsg);
      this.options.onChatMessage?.(agentMsg);

      // 2. Synthesize voice if in voice or duplex mode
      if (this.options.mode === 'voice' || this.options.mode === 'duplex' || !this.options.mode) {
        this.setState('SPEAKING');
        await this.synthesizeAndStream(replyText, abortController.signal);
      }

      if (!abortController.signal.aborted) {
        this.setState('IDLE');
      }

      return agentMsg;
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        // Normal interruption, silently exit
        return null;
      }
      this.setState('IDLE');
      throw err;
    } finally {
      this.isProcessing = false;
      this.currentAbortController = null;
    }
  }

  /**
   * Query EvaBrain API (Node backend on :3000 /api/ or direct fallback).
   */
  private async callBrainApi(prompt: string, signal: AbortSignal): Promise<string> {
    const brainUrl = this.options.brainApiUrl || 'http://127.0.0.1:3000/api/chat';
    try {
      const resp = await fetch(brainUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          persona: this.persona.id,
          systemPrompt: this.persona.systemPrompt,
          history: this.history.slice(-10),
        }),
        signal,
      });

      if (resp.ok) {
        const json = await resp.json();
        return json.reply || json.response || json.result || 'Здравствуйте! Я вас слушаю.';
      }
    } catch {
      // Fallback: graceful human response if API is temporarily unreachable
    }

    // Default conversational response if offline
    if (prompt.toLowerCase().includes('привет') || prompt.toLowerCase().includes('hello')) {
      return `Приветствую! На связи ${this.persona.name}. Готова подключиться к обсуждению. Чем могу помочь?`;
    }
    return `Поняла вас. Давайте разберём этот вопрос по существу. С точки зрения архитектуры это отличная идея.`;
  }

  /**
   * Synthesize spoken speech using EvaVoice backend (:8000) or local synthesis.
   */
  private async synthesizeAndStream(text: string, signal: AbortSignal): Promise<void> {
    const voiceUrl = this.options.voiceApiUrl || 'http://127.0.0.1:8000/tts';
    try {
      const resp = await fetch(voiceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: this.persona.voiceName,
          rate: this.persona.ttsRate || '+0%',
        }),
        signal,
      });

      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        if (signal.aborted) return;

        const chunk: AudioChunk = {
          data: Buffer.from(arrayBuf),
          sampleRate: 24000,
          channels: 1,
          encoding: 'mp3',
          timestamp: Date.now(),
          isFinal: true,
        };
        this.emit('audioChunkReady', chunk);
        this.options.onSpeechChunk?.(chunk);
      }
    } catch {
      // Fallback audio simulated chunk if offline
      const placeholder: AudioChunk = {
        data: Buffer.alloc(0),
        sampleRate: 24000,
        channels: 1,
        encoding: 'pcm16',
        timestamp: Date.now(),
        isFinal: true,
      };
      this.emit('audioChunkReady', placeholder);
    }
  }
}
