"""Vercel Serverless Function: Image Editing via Gemini."""

import base64
import json
import os
from http.server import BaseHTTPRequestHandler

from google import genai
from google.genai import types


def _detect_mime_type(data: bytes) -> str:
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
            # Get API key from environment
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                self._send_error(500, "GEMINI_API_KEY not configured")
                return

            # Parse request body
            content_length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(content_length))

            prompt = body.get("prompt", "")
            image_b64 = body.get("image", "")
            mime_type = body.get("mime_type", "image/jpeg")
            model = body.get("model", "gemini-2.0-flash-exp")

            if not prompt:
                self._send_error(400, "prompt is required")
                return
            if not image_b64:
                self._send_error(400, "image is required")
                return

            # Initialize Gemini client
            client = genai.Client(api_key=api_key)

            # Decode input image
            image_bytes = base64.b64decode(image_b64)

            # Build multimodal content
            contents = [
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                types.Part.from_text(text=prompt),
            ]

            # Generate edited image
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE", "TEXT"],
                ),
            )

            # Extract images from response
            images = []
            text = None

            if response.candidates:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'inline_data') and part.inline_data:
                        img_data = part.inline_data.data
                        if isinstance(img_data, str):
                            img_bytes = base64.b64decode(img_data)
                        else:
                            img_bytes = img_data

                        detected_mime = _detect_mime_type(img_bytes)
                        images.append({
                            "data": base64.b64encode(img_bytes).decode('utf-8'),
                            "mime_type": detected_mime,
                        })
                    elif hasattr(part, 'text') and part.text:
                        text = part.text

            # Build response
            result = {
                "text": text,
                "images": images,
                "model": model,
                "usage": None,
            }

            self._send_json(200, result)

        except Exception as e:
            self._send_error(503, f"Image editing error: {str(e)}")

    def _send_json(self, status: int, data: dict):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _send_error(self, status: int, message: str):
        self._send_json(status, {"detail": message})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
