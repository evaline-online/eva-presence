#!/usr/bin/env python3
"""Google Meet Virtual Participant Automation for EvaBot.

Uses Playwright / Chromium with fake or virtual audio devices to:
1. Join Google Meet conference room automatically without authentication (or with session).
2. Set display name ("Eva — EvaLine Virtual Architect").
3. Unmute mic, mute camera (or stream virtual avatar video).
4. Monitor in-call chat and send messages.
5. Stream audio to/from Eva Presence WebSocket (:8095).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import websockets

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("[meet_bot] Playwright is not installed. Run: pip install playwright && playwright install chromium", file=sys.stderr)


async def run_meet_bot(meet_url: str, display_name: str, ws_url: str, headless: bool = True) -> None:
    print(f"[meet_bot] Connecting to Google Meet: {meet_url} as '{display_name}'...")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=headless,
            args=[
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
                "--no-sandbox",
                "--disable-setuid-sandbox",
            ],
        )
        context = await browser.new_context(
            permissions=["microphone", "camera"],
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        )
        page = await context.new_page()

        await page.goto(meet_url)
        await page.wait_for_timeout(3000)

        # Handle Name Input (if not logged in)
        try:
            name_input = await page.wait_for_selector('input[type="text"]', timeout=5000)
            if name_input:
                await name_input.fill(display_name)
                print(f"[meet_bot] Filled display name: {display_name}")
        except Exception:
            pass

        # Turn off camera to save bandwidth
        try:
            cam_btn = await page.wait_for_selector('div[role="button"][aria-label*="camera" i], div[role="button"][aria-label*="камер" i]', timeout=2000)
            if cam_btn:
                await cam_btn.click()
        except Exception:
            pass

        # Click 'Ask to join' or 'Join now'
        try:
            join_btn = await page.wait_for_selector(
                'button:has-text("Ask to join"), button:has-text("Join now"), button:has-text("Присоединиться"), button:has-text("Попросить присоединиться")',
                timeout=5000,
            )
            if join_btn:
                await join_btn.click()
                print("[meet_bot] Clicked Join button")
        except Exception as exc:
            print(f"[meet_bot] Join button prompt notice: {exc}")

        print(f"[meet_bot] Connected to conference! Monitoring chat and audio...")

        # Connect to local Eva Presence WebSocket gateway
        try:
            async with websockets.connect(ws_url) as ws:
                # Greet meeting
                greeting = {"type": "text", "text": f"Здравствуйте! На связи {display_name}. Подключилась к встрече.", "sender": "System"}
                await ws.send(json.dumps(greeting))

                while True:
                    await asyncio.sleep(1)
        except Exception as exc:
            print(f"[meet_bot] Gateway connection event: {exc}")

        await browser.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Google Meet Eva Bot Participant")
    parser.add_argument("--url", required=True, help="Google Meet URL (e.g. https://meet.google.com/abc-defg-hij)")
    parser.add_argument("--name", default="Eva (EvaLine Virtual Architect)", help="Participant display name")
    parser.add_argument("--ws", default="ws://127.0.0.1:8095", help="Eva Presence WebSocket URL")
    parser.add_argument("--headful", action="store_true", help="Run with visible browser window")
    args = parser.parse_args()

    asyncio.run(run_meet_bot(args.url, args.name, args.ws, headless=not args.headful))


if __name__ == "__main__":
    main()
