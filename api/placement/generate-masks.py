"""Generate segmentation masks for product regions."""

import base64
import json
import os
from http.server import BaseHTTPRequestHandler

from google import genai
from google.genai import types


MASK_PROMPT = """CRITICAL: Create a BINARY SILHOUETTE MASK image.

TARGET OBJECT: {product_name}

INSTRUCTIONS:
1. Replace the ENTIRE image with a two-color mask
2. Fill the {product_name} silhouette with SOLID WHITE (#FFFFFF)
3. Fill ALL other areas with SOLID BLACK (#000000)
4. NO gradients, NO gray tones, NO textures, NO image details
5. Output ONLY a white shape on pure black background

This is for computer vision - must be exact binary mask output.
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

            tasks = data.get("tasks", [])
            if not tasks:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"detail": "No tasks provided"}).encode())
                return

            client = genai.Client(api_key=api_key)
            masks = []

            for task in tasks:
                product_name = task.get("product_name", "product")
                prompt = MASK_PROMPT.format(product_name=product_name)

                # Decode composed image
                image_data = base64.b64decode(task.get("composed_image", ""))
                mime_type = task.get("mime_type", "image/jpeg")

                parts = [
                    types.Part.from_text(text=prompt),
                    types.Part.from_bytes(data=image_data, mime_type=mime_type),
                ]
                contents = [types.Content(role="user", parts=parts)]
                config = types.GenerateContentConfig(
                    response_modalities=["TEXT", "IMAGE"],
                )

                response = client.models.generate_content(
                    model="gemini-2.0-flash-exp",
                    contents=contents,
                    config=config,
                )

                # Extract mask
                if response.candidates:
                    for candidate in response.candidates:
                        if candidate.content and candidate.content.parts:
                            for part in candidate.content.parts:
                                if hasattr(part, "inline_data") and part.inline_data:
                                    inline = part.inline_data
                                    if hasattr(inline, "data") and inline.data:
                                        mask_mime = detect_mime_type(inline.data)
                                        masks.append({
                                            "scene_id": task.get("scene_id", ""),
                                            "mask_data": base64.b64encode(inline.data).decode("utf-8"),
                                            "mime_type": mask_mime,
                                        })
                                        break

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"masks": masks}).encode())

        except Exception as e:
            self.send_response(503)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"detail": f"Mask generation failed: {str(e)}"}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
