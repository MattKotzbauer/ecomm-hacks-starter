"""Compose products into scene images."""

import base64
import json
import os
from http.server import BaseHTTPRequestHandler

from google import genai
from google.genai import types


COMPOSE_PROMPT = """Edit the FIRST image (lifestyle scene) to naturally include the product shown in the SECOND image.
This is a {product_brand} {product_name}.
Place the product {placement_hint}.
IMPORTANT:
- Use the EXACT product from the second image - match its shape, color, details, and branding precisely
- Integrate it seamlessly into the first image's lighting, shadows, and atmosphere
- The product should look like it was photographed in the scene, not composited
- Maintain the original scene's style and composition
- Output the image at the SAME resolution and dimensions as the first input image
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
            images = []

            for task in tasks:
                product = task.get("product", {})
                prompt = COMPOSE_PROMPT.format(
                    product_brand=product.get("brand", ""),
                    product_name=product.get("name", ""),
                    placement_hint=task.get("placement_hint", "naturally in the scene"),
                )

                # Decode scene image
                scene_data = base64.b64decode(task.get("scene_image", ""))
                scene_mime = task.get("scene_mime_type", "image/jpeg")

                # Build parts: prompt + scene image
                parts = [
                    types.Part.from_text(text=prompt),
                    types.Part.from_bytes(data=scene_data, mime_type=scene_mime),
                ]

                # Add product reference image if available
                if task.get("product_image"):
                    product_data = base64.b64decode(task["product_image"])
                    product_mime = task.get("product_mime_type", "image/jpeg")
                    parts.append(types.Part.from_bytes(data=product_data, mime_type=product_mime))

                contents = [types.Content(role="user", parts=parts)]
                config = types.GenerateContentConfig(
                    response_modalities=["TEXT", "IMAGE"],
                )

                response = client.models.generate_content(
                    model="gemini-2.5-flash-preview-05-20",
                    contents=contents,
                    config=config,
                )

                # Extract composed image
                if response.candidates:
                    for candidate in response.candidates:
                        if candidate.content and candidate.content.parts:
                            for part in candidate.content.parts:
                                if hasattr(part, "inline_data") and part.inline_data:
                                    inline = part.inline_data
                                    if hasattr(inline, "data") and inline.data:
                                        mime_type = detect_mime_type(inline.data)
                                        images.append({
                                            "scene_id": task.get("scene_id", ""),
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
            self.wfile.write(json.dumps({"detail": f"Image composition failed: {str(e)}"}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
