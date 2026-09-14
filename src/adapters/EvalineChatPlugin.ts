/**
 * eva-presence / adapters/EvalineChatPlugin.ts
 * Native plugin implementation for the EvaLine enterprise chat engine (evaline-chat).
 */

import { DialogSession } from '../core/DialogSession.js';
import type { PresenceOptions } from '../types.js';

export interface EvalinePluginContext {
  registerCommand(command: string, handler: (args: string) => Promise<string> | string): void;
  registerRoute(method: string, path: string, handler: (params: unknown) => Promise<unknown> | unknown): void;
}

export class EvalineChatPlugin {
  readonly manifest = {
    id: 'eva-presence',
    name: 'EvaBot Omnichannel Virtual Human Presence',
    version: '0.1.0',
    description: 'Pluggable virtual human participant with voice & text for Google Meet, Telegram & any app',
    author: 'EvaLine Collective',
    enabled: true,
    category: 'omnichannel-presence',
  };

  private readonly session: DialogSession;

  constructor(options: PresenceOptions = {}) {
    this.session = new DialogSession(options);
  }

  public async initialize(ctx: EvalinePluginContext): Promise<void> {
    // Register /meet slash command in evaline-chat
    ctx.registerCommand('/meet', async (args: string) => {
      const trimmed = args.trim();
      if (!trimmed) {
        return 'Использование: `/meet https://meet.google.com/abc-defg-hij` — подключает Еву к видеоконференции Google Meet.';
      }
      return `Ева готовится к подключению в Google Meet: ${trimmed}. Микрофон и транскрибация активны.`;
    });

    // Register /voice slash command
    ctx.registerCommand('/voice', async (args: string) => {
      const mode = args.trim() || 'duplex';
      return `Голосовой режим Евы переключен в: **${mode}**. Голосовой пайплайн активен.`;
    });

    // Register status route
    ctx.registerRoute('GET', '/presence/status', async () => {
      return {
        plugin: this.manifest.id,
        persona: this.session.getPersona(),
        state: this.session.getState(),
      };
    });
  }

  public getSession(): DialogSession {
    return this.session;
  }

  public async healthCheck(): Promise<{ status: string; message: string }> {
    return {
      status: 'healthy',
      message: `Eva Presence is ready. State: ${this.session.getState()}`,
    };
  }
}
