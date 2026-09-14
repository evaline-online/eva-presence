#!/usr/bin/env node
/**
 * eva-presence / cli.ts
 * Command-line runner for Eva Virtual Human Presence.
 */

import readline from 'node:readline';
import { DialogSession } from './core/DialogSession.js';
import { GoogleMeetAdapter } from './adapters/GoogleMeetAdapter.js';
import { GoogleMeetFullStreamAdapter } from './adapters/GoogleMeetFullStreamAdapter.js';
import { RtmpLiveStreamAdapter } from './adapters/RtmpLiveStreamAdapter.js';
import { TelegramAdapter } from './adapters/TelegramAdapter.js';
import { UniversalWsAdapter } from './adapters/UniversalWsAdapter.js';
import type { PresenceState } from './types.js';

function parseArgs(args: string[]): { command: string; flags: Record<string, string> } {
  const command = args[0] || 'help';
  const flags: Record<string, string> = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true';
      flags[key] = val;
    }
  }
  return { command, flags };
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));

  console.log(`\x1b[36m========================================================\x1b[0m`);
  console.log(`\x1b[35m  EvaBot Presence — Omnichannel Virtual Human Plugin\x1b[0m`);
  console.log(`\x1b[36m========================================================\x1b[0m\n`);

  if (command === 'meet-full') {
    const url = flags.url || flags.u;
    if (!url) {
      console.error('\x1b[31mОшибка: укажите URL конференции через --url https://meet.google.com/xxx-xxxx-xxx\x1b[0m');
      process.exit(1);
    }
    const session = new DialogSession({
      persona: (flags.persona as 'eva' | 'adam') || 'eva',
      mode: 'duplex',
      onStateChange: (state: PresenceState) => {
        console.log(`\x1b[33m[Eva State]\x1b[0m ${state}`);
      },
    });
    const adapter = new GoogleMeetFullStreamAdapter(session, {
      meetingUrl: url,
      displayName: flags.name || 'Ева (EvaLine AI Partner)',
      faceUrl: flags.face || 'http://127.0.0.1:8093/',
      headless: flags.headless !== 'false',
    });

    console.log(`[Google Meet Full] Запуск видеопотока 3D Лица и аудиопотока Голоса...`);
    await adapter.connect();
    console.log(`\x1b[32m[OK] Ева вошла в конференцию с Камерой (3D Лицо) и Микрофоном (Голос).\x1b[0m`);
  } else if (command === 'stream') {
    const rtmpUrl = flags.rtmp || flags.url;
    if (!rtmpUrl) {
      console.error('\x1b[31mОшибка: укажите RTMP URL через --rtmp rtmp://a.rtmp.youtube.com/live2/KEY\x1b[0m');
      process.exit(1);
    }
    const session = new DialogSession({
      persona: (flags.persona as 'eva' | 'adam') || 'eva',
      mode: 'duplex',
    });
    const adapter = new RtmpLiveStreamAdapter(session, { rtmpUrl });
    console.log(`[Live Stream] Запуск RTMP вещания 3D лица и голоса...`);
    await adapter.connect();
    console.log(`\x1b[32m[OK] Прямой эфир запущен.\x1b[0m`);
  } else if (command === 'meet') {
    const url = flags.url || flags.u;
    if (!url) {
      console.error('\x1b[31mОшибка: укажите URL конференции через --url https://meet.google.com/xxx-xxxx-xxx\x1b[0m');
      process.exit(1);
    }
    const session = new DialogSession({
      persona: (flags.persona as 'eva' | 'adam') || 'eva',
      mode: 'duplex',
      onStateChange: (state: PresenceState) => {
        console.log(`\x1b[33m[Eva State]\x1b[0m ${state}`);
      },
    });
    const adapter = new GoogleMeetAdapter(session, {
      meetingUrl: url,
      displayName: flags.name || 'Eva (EvaLine AI Partner)',
      headless: flags.headless !== 'false',
    });

    console.log(`Подключение к Google Meet: ${url}...`);
    await adapter.connect();
    console.log(`\x1b[32m[OK] Ева подключена к конференции Google Meet.\x1b[0m Нажмите Ctrl+C для выхода.`);
  } else if (command === 'telegram') {
    const session = new DialogSession({
      persona: (flags.persona as 'eva' | 'adam') || 'eva',
      mode: 'duplex',
      onStateChange: (state: PresenceState) => {
        console.log(`\x1b[33m[Eva State]\x1b[0m ${state}`);
      },
    });
    const adapter = new TelegramAdapter(session, {
      botToken: flags.token || process.env.TELEGRAM_BOT_TOKEN,
      defaultChatId: flags.chat,
    });
    await adapter.connect();
    console.log(`\x1b[32m[OK] Telegram адаптер активен.\x1b[0m Нажмите Ctrl+C для выхода.`);
  } else if (command === 'server') {
    const port = Number(flags.port) || 8095;
    const session = new DialogSession({
      persona: (flags.persona as 'eva' | 'adam') || 'eva',
      mode: 'duplex',
    });
    const adapter = new UniversalWsAdapter(session, { port });
    await adapter.connect();
    console.log(`\x1b[32m[OK] Universal WebSocket Server запущен на ws://0.0.0.0:${port}\x1b[0m`);
  } else if (command === 'console') {
    const session = new DialogSession({
      persona: (flags.persona as 'eva' | 'adam') || 'eva',
      mode: 'text',
      onStateChange: (state: PresenceState) => {
        if (state === 'THINKING') process.stdout.write('\x1b[33m[Ева думает...]\x1b[0m ');
      },
    });

    console.log(`Интерактивный диалог с: \x1b[32m${session.getPersona().name}\x1b[0m (${session.getPersona().title})`);
    console.log(`Введите сообщение и нажмите Enter. Напишите 'exit' для выхода.\n`);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const promptUser = () => {
      rl.question('\x1b[34mВы: \x1b[0m', async (line) => {
        const text = line.trim();
        if (text.toLowerCase() === 'exit' || text.toLowerCase() === 'quit') {
          rl.close();
          process.exit(0);
        }
        if (text) {
          const reply = await session.handleIncomingUserMessage(text, 'User');
          if (reply) {
            console.log(`\x1b[35m${session.getPersona().name}: \x1b[0m${reply.text}\n`);
          }
        }
        promptUser();
      });
    };
    promptUser();
  } else {
    console.log(`Доступные команды:
  \x1b[32mmeet-full\x1b[0m --url <meet-url> [--face <url>]           Подключить Еву с КАМЕРОЙ (3D Лицо) и МИКРОФОНОМ (Голос)
  \x1b[32mstream\x1b[0m    --rtmp <rtmp-url>                          Трансляция 3D Лица и Голоса в YouTube Live / Twitch / Telegram
  \x1b[32mmeet\x1b[0m      --url <google-meet-url>                    Подключить Еву к конференции Google Meet (только аудио/чат)
  \x1b[32mtelegram\x1b[0m  [--token <bot-token>] [--chat <id>]        Запустить бота Telegram с голосом и текстом
  \x1b[32mserver\x1b[0m    [--port 8095]                              Запустить Universal WebSocket шлюз для любых приложений
  \x1b[32mconsole\x1b[0m   [--persona eva|adam]                       Интерактивный тестовый диалог в терминале
`);
  }
}

main().catch((err) => {
  console.error('\x1b[31mФатальная ошибка:\x1b[0m', err);
  process.exit(1);
});
