/**
 * eva-presence / index.ts
 * Main library entrypoint for @evaline/presence.
 */

export * from './types.js';
export { EVA_PERSONA, ADAM_PERSONA, getPersona } from './core/EvaPersona.js';
export { DialogSession, type DialogSessionEvents } from './core/DialogSession.js';
export { VoicePipeline, VadDetector, type VadOptions } from './core/VoicePipeline.js';
export { BaseAdapter } from './adapters/BaseAdapter.js';
export { GoogleMeetAdapter } from './adapters/GoogleMeetAdapter.js';
export { TelegramAdapter } from './adapters/TelegramAdapter.js';
export { UniversalWsAdapter } from './adapters/UniversalWsAdapter.js';
export { EvalineChatPlugin } from './adapters/EvalineChatPlugin.js';
