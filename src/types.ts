/**
 * eva-presence / types.ts
 * Core type contracts for Eva Virtual Human Omnichannel Presence Plugin.
 */

export type PresenceState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'INTERRUPTED';

export type ChannelType = 'google-meet' | 'telegram' | 'universal-ws' | 'webrtc' | 'custom';

export type OperatingMode = 'voice' | 'text' | 'duplex';

export interface PersonaConfig {
  readonly id: string;
  readonly name: string;
  readonly gender: 'female' | 'male' | 'neutral';
  readonly title: string;
  readonly voiceName: string;
  readonly ttsRate?: string;
  readonly ttsVolume?: string;
  readonly systemPrompt: string;
  readonly languages: string[];
}

export interface ChatMessage {
  readonly id: string;
  readonly sender: string;
  readonly senderId?: string;
  readonly text: string;
  readonly isAgent: boolean;
  readonly timestamp: number;
  readonly channel: ChannelType;
  readonly metadata?: Record<string, unknown>;
}

export interface AudioChunk {
  readonly data: Buffer | Uint8Array;
  readonly sampleRate: number;
  readonly channels: number;
  readonly encoding: 'pcm16' | 'mp3' | 'opus' | 'wav';
  readonly timestamp: number;
  readonly isFinal?: boolean;
}

export interface GoogleMeetConfig {
  readonly meetingUrl: string;
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly headless?: boolean;
  readonly chromeExecutable?: string;
  readonly enableInCallChat?: boolean;
  readonly enableVoice?: boolean;
  readonly autoJoin?: boolean;
}

export interface TelegramConfig {
  readonly botToken?: string;
  readonly apiId?: number;
  readonly apiHash?: string;
  readonly sessionString?: string;
  readonly defaultChatId?: string | number;
  readonly voiceNotesEnabled?: boolean;
  readonly groupCallEnabled?: boolean;
}

export interface UniversalWsConfig {
  readonly port?: number;
  readonly host?: string;
  readonly path?: string;
}

export interface PresenceOptions {
  readonly persona?: 'eva' | 'adam' | 'auto';
  readonly mode?: OperatingMode;
  readonly brainApiUrl?: string;
  readonly voiceApiUrl?: string;
  readonly geminiApiKey?: string;
  readonly language?: string;
  readonly onStateChange?: (state: PresenceState, previous: PresenceState) => void;
  readonly onTranscript?: (speaker: string, text: string, isFinal: boolean) => void;
  readonly onSpeechChunk?: (chunk: AudioChunk) => void;
  readonly onChatMessage?: (msg: ChatMessage) => void;
}

export interface IPlatformAdapter {
  readonly name: string;
  readonly channelType: ChannelType;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendText(text: string, replyToMessageId?: string): Promise<void>;
  sendAudio(chunk: AudioChunk): Promise<void>;
  isConnected(): boolean;
}
