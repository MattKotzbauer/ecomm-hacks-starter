"""Generate images from scene descriptions."""

import base64
import json
import os
from http.server import BaseHTTPRequestHandler

from google import genai
from google.genai import types


IMAGE_PROMPT = """Generate a high-quality lifestyle photograph:

{scene_description}

Mood: {mood}
Style: Professional photography, natural lighting, luxury aesthetic.
IMPORTANT: Do NOT include any luxury products, handbags, watches, accessories, or branded items in the scene.
Generate ONLY the environment/setting itself - people, furniture, architecture, nature, etc.
Leave natural empty spaces on surfaces where objects could later be added.
"""


def detect_mime_type(data: bytes) -> str:
    """Detect actual image MIME type from magic bytes."""
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png"
    elif data[:2] == b'\xff\xd8':
        return "image/jpeg"
    elif data[:4] == b'RIFF' and len(data) > 12 and data[8:12] == b'WEBP':
        return "image/webp"
    return "image/png"


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"detail": "GEMINI_API_KEY not configured"}).encode())
                return

            scenes = data.get("scenes", [])
            if not scenes:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"detail": "No scenes provided"}).encode())
                return

            client = genai.Client(api_key=api_key)
            images = []

            for scene in scenes:
                prompt = IMAGE_PROMPT.format(
                    scene_description=scene.get("scene_description", ""),
                    mood=scene.get("mood", "warm"),
                )

                config = types.GenerateContentConfig(
                    response_modalities=["TEXT", "IMAGE"],
                )

                response = client.models.generate_content(
                    model="gemini-2.0-flash-exp",
                    contents=prompt,
                    config=config,
                )

                # Extract image from response
                if response.candidates:
                    for candidate in response.candidates:
                        if candidate.content and candidate.content.parts:
                            for part in candidate.content.parts:
                                if hasattr(part, "inline_data") and part.inline_data:
                                    inline = part.inline_data
                                    if hasattr(inline, "data") and inline.data:
                                        mime_type = detect_mime_type(inline.data)
                                        images.append({
                                            "scene_id": scene.get("scene_id", ""),
                                            "image_data": base64.b64encode(inline.data).decode("utf-8"),
                                            "mime_type": mime_type,
                                        })
                                        break

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"images": images}).encode())

        except Exception as e:
            self.send_response(503)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"detail": f"Image generation failed: {str(e)}"}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
