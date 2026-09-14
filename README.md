# @evaline/presence (EvaBot Presence)

> **Автономный виртуальный участник с человеческим голосом и текстовым режимом для Google Meet, Telegram и любых внешних приложений.**

Пакет и подключаемый плагин экосистемы **EvaLine / EvaBot**, позволяющий подключать цифрового сотрудника — **Еву** (или **Адама**) — как реального человека к конференциям, звонкам и корпоративным чатам.

---

## 🌟 Ключевые возможности

1. **Google Meet Virtual Participant**:
   - Автоматическое подключение к звонку по ссылке (`https://meet.google.com/xxx-xxxx-xxx`).
   - Отображение имени (напр. *«Ева — Архитектор EvaLine»*) и аватара.
   - **Голос в реальном времени**: непрерывный дуплексный диалог через Web Audio / виртуальный микрофон.
   - **Barge-in (перебивание)**: если человек начинает говорить, Ева моментально замолкает, слушает и отвечает по сути без каши в эфире.
   - **Текстовый чат**: параллельно читает чат звонка и пишет структурированные ответы, ссылки и резюме встречи.

2. **Telegram Omnichannel Agent**:
   - **Текстовые диалоги**: личные и групповые чаты (Markdown, команды, треды).
   - **Голосовые сообщения (Voice Notes)**: мгновенный синтез речи в нативный Telegram-формат **OGG Opus** и распознавание входящих голосовых.
   - **Групповые аудиозвонки (Voice Chats / Live Streams)**: подключение к голосовому чату канала/группы через WebRTC/MTProto.

3. **Universal Plugin Interface (Подключение к любому приложению)**:
   - **WebSocket / REST шлюз** (`ws://host:8095`): подключение к CRM, веб-сайтам, мобильным приложениям, играм, Zoom, Discord, Slack.
   - **Плагин для `evaline-chat`**: нативная загрузка в корпоративный движок чата с командами `/meet` и `/voice`.

4. **Персона Евы**:
   - **Роль**: Lead Frontend Architect, UX Director & Global Brand Ambassador.
   - **Голос**: чистый, выразительный, теплый и интеллектуальный женский голос (`ru-RU-SvetlanaNeural` в EdgeTTS / `Aoede` в Gemini Multimodal Live).
   - **Языки**: русский, украинский, английский, польский, румынский.
   - **Передача слова (Handover)**: при вопросах по низкоуровневой инфраструктуре или запросе Адама плавно передаёт слово персоне **Adam**.

---

## 🏗 Архитектура

```
+-------------------------------------------------------------------------+
|                              EvaBot Presence                            |
+-------------------------------------------------------------------------+
|  [EvaPersona / AdamPersona]  <--->  [DialogSession State Machine]        |
|  - System Prompts                   - IDLE -> LISTENING -> THINKING     |
|  - Speech Ergonomics                - SPEAKING -> INTERRUPTED (Barge-in)|
|  - Handover Rules                   - Turn-taking & Silence Detection   |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                             Core Pipelines                              |
|  - Brain Connector: EvaBrain API (:3000) / Gemini Multimodal Live API   |
|  - Voice Pipeline: EvaVoice (:8000) / Edge-TTS / CloudSTT / OGG Opus   |
|  - VAD: Real-time RMS energy & silence detector                         |
+-------------------------------------------------------------------------+
                                     |
    +--------------------------------+-------------------------------+
    |                                |                               |
    v                                v                               v
+-----------------------+ +-----------------------+ +-----------------------+
|  Google Meet Adapter  | |   Telegram Adapter    | | Universal WS Adapter  |
| - Headless Chromium   | | - Bot API             | | - ws://0.0.0.0:8095   |
| - Virtual Audio Stream| | - Voice Notes (.ogg)  | | - Ingest any app      |
| - In-Call Chat Reader | | - Group Voice Chats   | | - Embed in React/Vue  |
+-----------------------+ +-----------------------+ +-----------------------+
```

---

## 🚀 Быстрый старт

### Установка зависимостей и сборка
```bash
npm install
npm run build
npm test
```

### 1. Подключение Евы к конференции Google Meet
```bash
# Подключение по ссылке на встречу
npm run meet -- --url "https://meet.google.com/abc-defg-hij" --name "Ева (EvaLine AI Partner)"

# Или через глобальный CLI:
node dist/cli.js meet --url "https://meet.google.com/abc-defg-hij"
```

### 2. Запуск в Telegram
```bash
export TELEGRAM_BOT_TOKEN="your_bot_token"
npm run telegram
```

### 3. Запуск Universal WebSocket шлюза (для любого приложения)
```bash
npm run server -- --port 8095
```
Любое стороннее приложение подключается по WebSocket:
```javascript
const ws = new WebSocket('ws://localhost:8095');

// Отправить текстовое сообщение:
ws.send(JSON.stringify({
  type: 'text',
  sender: 'Алексей',
  text: 'Привет, Ева! Расскажи о статусе проекта.'
}));

// Получение ответа:
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'text') {
    console.log(`${data.sender}: ${data.text}`);
  }
  if (data.type === 'audio') {
    // data.audioBase64 (MP3 или PCM)
    playAudio(data.audioBase64);
  }
};
```

### 4. Подключение как плагин в `evaline-chat`
```typescript
import { createChatEngine } from 'evaline-chat';
import { EvalineChatPlugin } from '@evaline/presence';

const presencePlugin = new EvalineChatPlugin({
  persona: 'eva',
  mode: 'duplex',
});

const engine = await createChatEngine({
  plugins: [presencePlugin],
});
```

---

## ⚙ Конфигурация (`config.json` или переменные окружения)

| Переменная | По умолчанию | Описание |
| :--- | :--- | :--- |
| `PRESENCE_PORT` | `8095` | Порт Universal WebSocket шлюза |
| `BRAIN_API_URL` | `http://127.0.0.1:3000/api/chat` | Адрес бэкенда EvaBrain |
| `VOICE_API_URL` | `http://127.0.0.1:8000/tts` | Адрес сервиса EvaVoice |
| `TELEGRAM_BOT_TOKEN` | - | Токен Telegram бота |
| `CHROME_PATH` | `/usr/bin/chromium` | Путь к бинарнику Chromium |

---

## 🧪 Тестирование
```bash
npm test
```
Запускает unit-тесты:
- `persona.test.ts` — проверка персон Евы и Адама, мультиязычность.
- `session.test.ts` — стейт-машина диалога, обработка перебивания (barge-in).
- `universal.test.ts` — WebSocket адаптер и плагин для `evaline-chat`.

---

## 📄 Лицензия
MIT © EvaLine Collective & EvaBot Online
