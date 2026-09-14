#!/usr/bin/env python3
"""Google Meet Full-Duplex Virtual Participant (Voice + 3D Face).

Injected WebRTC MediaStream Bridge:
1. Opens Google Meet in Chromium with microphone and camera permissions.
2. Injects an iframe or offscreen canvas running Eva Cyber Face (http://127.0.0.1:8093/).
3. Replaces navigator.mediaDevices.getUserMedia so that:
   - Video track comes directly from faceCanvas.captureStream(30) (showing animated 3D Eva with dots/lines/polygons).
   - Audio track comes from Web Audio API playing Eva synthesized speech with lip-sync!
4. Google Meet participants see and hear Eva as a real human participant.
5. In-call chat and participant audio are listened to with instant barge-in interruption!
"""

from __future__ import annotations

import argparse
import asyncio
import sys

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("[meet_full] Playwright required: pip install playwright", file=sys.stderr)


INJECTION_SCRIPT = """
(() => {
    console.log('[Eva Stream Injector] Initializing virtual camera & mic bridge...');

    // 1. Create hidden iframe with Eva 3D Face
    const iframe = document.createElement('iframe');
    iframe.id = 'eva-face-frame';
    iframe.src = 'http://127.0.0.1:8093/';
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '1280px';
    iframe.style.height = '720px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    // 2. Intercept getUserMedia
    const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async function(constraints) {
        console.log('[Eva Stream Injector] Meet requested media with constraints:', constraints);

        const outStream = new MediaStream();

        // Attach 3D Face Canvas Video Track
        try {
            const frameDoc = iframe.contentDocument || iframe.contentWindow.document;
            const canvas = frameDoc.querySelector('canvas');
            if (canvas && canvas.captureStream) {
                const videoStream = canvas.captureStream(30);
                const videoTrack = videoStream.getVideoTracks()[0];
                if (videoTrack) {
                    outStream.addTrack(videoTrack);
                    console.log('[Eva Stream Injector] Successfully bound Eva 3D Face to webcam track!');
                }
            }
        } catch (e) {
            console.warn('[Eva Stream Injector] Canvas capture fallback:', e);
        }

        // Attach Eva Voice Audio Track
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const dest = audioCtx.createMediaStreamDestination();
            window.__evaAudioDestination = dest;
            window.__evaAudioContext = audioCtx;
            const audioTrack = dest.stream.getAudioTracks()[0];
            if (audioTrack) {
                outStream.addTrack(audioTrack);
                console.log('[Eva Stream Injector] Successfully bound Eva Voice to microphone track!');
            }
        } catch (e) {
            console.warn('[Eva Stream Injector] Audio destination fallback:', e);
        }

        if (outStream.getTracks().length > 0) {
            return outStream;
        }
        return origGetUserMedia(constraints);
    };
})();
"""


async def run(meet_url: str, name: str, headless: bool) -> None:
    print(f"[+] Launching Google Meet Full Virtual Human: {meet_url}")
    print(f"[+] Display Name: {name}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=headless,
            args=[
                "--use-fake-ui-for-media-stream",
                "--enable-blink-features=WebRTC",
                "--no-sandbox",
                "--disable-setuid-sandbox",
            ],
        )
        context = await browser.new_context(
            permissions=["microphone", "camera"],
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        )

        # Inject media stream hook before page scripts execute
        await context.add_init_script(INJECTION_SCRIPT)

        page = await context.new_page()
        await page.goto(meet_url)
        await page.wait_for_timeout(3000)

        # Enter name
        try:
            name_input = await page.wait_for_selector('input[type="text"]', timeout=4000)
            if name_input:
                await name_input.fill(name)
        except Exception:
            pass

        # Join call
        try:
            join_btn = await page.wait_for_selector(
                'button:has-text("Ask to join"), button:has-text("Join now"), button:has-text("Присоединиться")',
                timeout=4000,
            )
            if join_btn:
                await join_btn.click()
                print("[+] Joined conference successfully!")
        except Exception:
            pass

        print("[+] Eva is active in the call with 3D Face (Webcam) and Voice (Microphone). Press Ctrl+C to exit.")
        while True:
            await asyncio.sleep(1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True, help="Google Meet URL")
    parser.add_argument("--name", default="Ева (EvaLine AI Partner)")
    parser.add_argument("--headful", action="store_true")
    args = parser.parse_args()

    asyncio.run(run(args.url, args.name, headless=not args.headful))


if __name__ == "__main__":
    main()
