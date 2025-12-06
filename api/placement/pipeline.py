"""Unified pipeline - runs all 5 steps in one call."""

import base64
import json
import os
import re
import time
import urllib.request
from http.server import BaseHTTPRequestHandler

from google import genai
from google.genai import types


# === Prompt Templates ===

SCENES_PROMPT = """<system>
You are a creative director for luxury lifestyle imagery.
Generate scene descriptions for AI image generation, balancing user preferences with exploration.
</system>

<writing_context>
{writing_context}
</writing_context>

{liked_scenes_section}

<instructions>
Generate {total_count} scene descriptions based on the writing context.

SPLIT:
- {continuation_count} CONTINUATION scenes: These should align with the liked scenes above.
- {exploration_count} EXPLORATION scenes: These should explore DIFFERENT directions.

Requirements:
1. Each scene must be vivid and detailed for AI image generation
2. Suitable for placing luxury products naturally

If no liked scenes provided, generate all as exploration (diverse styles).
</instructions>

<output_format>
<scenes>
  <scene id="1" type="continuation">
    <description>Scene matching user preferences...</description>
    <mood>warm</mood>
  </scene>
  <scene id="2" type="exploration">
    <description>Different direction scene...</description>
    <mood>dramatic</mood>
  </scene>
</scenes>
</output_format>
"""

IMAGE_PROMPT = """Generate a high-quality lifestyle photograph:

{scene_description}

Mood: {mood}
Style: Professional photography, natural lighting, luxury aesthetic.
IMPORTANT: Do NOT include any luxury products, handbags, watches, accessories, or branded items in the scene.
Generate ONLY the environment/setting itself - people, furniture, architecture, nature, etc.
Leave natural empty spaces on surfaces where objects could later be added.
"""

SELECT_PROMPT = """<system>
You are a luxury product placement specialist.
Select the most appropriate product for a given scene.
</system>

<writer_context>
{writing_context}
</writer_context>

<available_products>
{products_xml}
</available_products>

<instructions>
Analyze this lifestyle scene. Select ONE product that fits naturally.
If NO products match, select "NONE".
</instructions>

<output_format>
<selection>
  <product_id>selected product id OR "NONE"</product_id>
  <placement>specific location in scene</placement>
  <rationale>Brief explanation</rationale>
  <match_score>1-10</match_score>
</selection>
</output_format>
"""

COMPOSE_PROMPT = """Edit the FIRST image to naturally include the product shown in the SECOND image.
This is a {product_brand} {product_name}.
Place the product {placement_hint}.
IMPORTANT:
- Use the EXACT product from the second image
- Integrate it seamlessly into the first image's lighting and atmosphere
- The product should look like it was photographed in the scene
"""

MASK_PROMPT = """CRITICAL: Create a BINARY SILHOUETTE MASK image.
TARGET OBJECT: {product_name}
INSTRUCTIONS:
1. Fill the {product_name} silhouette with SOLID WHITE (#FFFFFF)
2. Fill ALL other areas with SOLID BLACK (#000000)
3. NO gradients, NO gray tones
"""


# === Helper Functions ===

def detect_mime_type(data: bytes) -> str:
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png"
    elif data[:2] == b'\xff\xd8':
        return "image/jpeg"
    elif data[:4] == b'RIFF' and len(data) > 12 and data[8:12] == b'WEBP':
        return "image/webp"
    return "image/png"


def build_liked_scenes_section(liked_scenes: list) -> str:
    if not liked_scenes:
        return "<liked_scenes>\n(No liked scenes yet - generate all as exploration)\n</liked_scenes>"

    scenes_xml = []
    for scene in liked_scenes:
        scenes_xml.append(
            f'  <scene mood="{scene.get("mood", "")}">\n'
            f"    <description>{scene.get('description', '')}</description>\n"
            f"  </scene>"
        )
    return f"<liked_scenes>\n{''.join(scenes_xml)}\n</liked_scenes>"


def parse_scenes_xml(text: str) -> list:
    scenes = []
    pattern = r'<scene id="(\d+)"(?: type="(continuation|exploration)")?\s*>\s*<description>(.*?)</description>\s*<mood>(.*?)</mood>\s*</scene>'
    matches = re.findall(pattern, text, re.DOTALL)

    for match in matches:
        scene_id, scene_type, description, mood = match
        scenes.append({
            "id": f"scene-{scene_id}",
            "description": description.strip(),
            "mood": mood.strip(),
            "scene_type": scene_type.strip() if scene_type else "exploration",
        })
    return scenes


def build_products_xml(products: list) -> str:
    product_xmls = []
    for p in products:
        product_xml = (
            f'<product id="{p.get("id", "")}" brand="{p.get("brand", "")}">\n'
            f"  <name>{p.get('name', '')}</name>\n"
            f"  <description>{p.get('description', 'Luxury product')}</description>\n"
            f"</product>"
        )
        product_xmls.append(product_xml)
    return "\n".join(product_xmls)


def parse_selection_xml(text: str, scene_id: str) -> dict:
    product_id = re.search(r"<product_id>(.*?)</product_id>", text, re.DOTALL)
    placement = re.search(r"<placement>(.*?)</placement>", text, re.DOTALL)
    rationale = re.search(r"<rationale>(.*?)</rationale>", text, re.DOTALL)
    match_score = re.search(r"<match_score>(.*?)</match_score>", text, re.DOTALL)

    if not all([product_id, placement]):
        raise ValueError("Failed to parse selection")

    score = 5
    if match_score:
        try:
            score = int(match_score.group(1).strip())
        except:
            pass

    return {
        "scene_id": scene_id,
        "selected_product_id": product_id.group(1).strip(),
        "placement_hint": placement.group(1).strip(),
        "rationale": rationale.group(1).strip() if rationale else "",
        "match_score": score,
    }


def fetch_image_url(url: str) -> tuple:
    """Fetch image from URL."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read()
            mime = detect_mime_type(data)
            return data, mime
    except:
        return None, None


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        pipeline_start = time.time()

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

            # Parse request
            writing_context = data.get("writing_context", "")
            products = data.get("products", [])
            liked_scenes = data.get("liked_scenes", [])
            scene_count = data.get("scene_count", 3)
            continuation_ratio = data.get("continuation_ratio", 0.6)

            if not writing_context or not products:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"detail": "writing_context and products required"}).encode())
                return

            client = genai.Client(api_key=api_key)
            stats = {"steps": {}}

            # Calculate split
            continuation_count = round(scene_count * continuation_ratio) if liked_scenes else 0
            exploration_count = scene_count - continuation_count

            # === Step 1: Generate Scenes ===
            step_start = time.time()
            liked_section = build_liked_scenes_section(liked_scenes)
            scenes_prompt = SCENES_PROMPT.format(
                writing_context=writing_context,
                liked_scenes_section=liked_section,
                total_count=scene_count,
                continuation_count=continuation_count,
                exploration_count=exploration_count,
            )

            scenes_response = client.models.generate_content(
                model="gemini-2.5-flash-preview-05-20",
                contents=scenes_prompt,
            )
            scenes = parse_scenes_xml(scenes_response.text)

            if not scenes:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"detail": "Failed to generate scenes"}).encode())
                return

            stats["steps"]["1_scenes"] = {"elapsed": round(time.time() - step_start, 3), "count": len(scenes)}

            # === Step 2: Generate Images ===
            step_start = time.time()
            images = []

            for scene in scenes:
                prompt = IMAGE_PROMPT.format(
                    scene_description=scene["description"],
                    mood=scene["mood"],
                )

                config = types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"])
                response = client.models.generate_content(
                    model="gemini-2.5-flash-preview-05-20",
                    contents=prompt,
                    config=config,
                )

                if response.candidates:
                    for candidate in response.candidates:
                        if candidate.content and candidate.content.parts:
                            for part in candidate.content.parts:
                                if hasattr(part, "inline_data") and part.inline_data:
                                    inline = part.inline_data
                                    if hasattr(inline, "data") and inline.data:
                                        images.append({
                                            "scene_id": scene["id"],
                                            "image_data": base64.b64encode(inline.data).decode("utf-8"),
                                            "mime_type": detect_mime_type(inline.data),
                                        })
                                        break

            if not images:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"detail": "Failed to generate images"}).encode())
                return

            stats["steps"]["2_images"] = {"elapsed": round(time.time() - step_start, 3), "count": len(images)}

            # === Step 3: Select Products ===
            step_start = time.time()
            products_xml = build_products_xml(products)
            selections = []

            for img in images:
                prompt = SELECT_PROMPT.format(
                    writing_context=writing_context,
                    products_xml=products_xml,
                )

                image_data = base64.b64decode(img["image_data"])
                parts = [
                    types.Part.from_text(text=prompt),
                    types.Part.from_bytes(data=image_data, mime_type=img["mime_type"]),
                ]
                contents = [types.Content(role="user", parts=parts)]

                response = client.models.generate_content(
                    model="gemini-2.5-flash-preview-05-20",
                    contents=contents,
                )

                try:
                    selection = parse_selection_xml(response.text, img["scene_id"])
                    if selection["selected_product_id"].upper() != "NONE":
                        selections.append(selection)
                except:
                    pass

            if not selections:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                result = {
                    "placements": [],
                    "stats": {
                        "total_elapsed": round(time.time() - pipeline_start, 3),
                        "placements_generated": 0,
                        "message": "No products matched the scenes",
                    }
                }
                self.wfile.write(json.dumps(result).encode())
                return

            stats["steps"]["3_selections"] = {"elapsed": round(time.time() - step_start, 3), "count": len(selections)}

            # === Pre-fetch product images ===
            product_images = {}
            for p in products:
                if p.get("image_url"):
                    img_data, img_mime = fetch_image_url(p["image_url"])
                    if img_data:
                        product_images[p["id"]] = (base64.b64encode(img_data).decode("utf-8"), img_mime)

            # === Step 4: Compose Images ===
            step_start = time.time()
            composed = []

            for selection in selections:
                scene_img = next((i for i in images if i["scene_id"] == selection["scene_id"]), None)
                product = next((p for p in products if p["id"] == selection["selected_product_id"]), None)

                if not scene_img or not product:
                    continue

                prompt = COMPOSE_PROMPT.format(
                    product_brand=product.get("brand", ""),
                    product_name=product.get("name", ""),
                    placement_hint=selection["placement_hint"],
                )

                scene_data = base64.b64decode(scene_img["image_data"])
                parts = [
                    types.Part.from_text(text=prompt),
                    types.Part.from_bytes(data=scene_data, mime_type=scene_img["mime_type"]),
                ]

                # Add product reference image if available
                if product["id"] in product_images:
                    prod_b64, prod_mime = product_images[product["id"]]
                    prod_data = base64.b64decode(prod_b64)
                    parts.append(types.Part.from_bytes(data=prod_data, mime_type=prod_mime))

                contents = [types.Content(role="user", parts=parts)]
                config = types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"])

                response = client.models.generate_content(
                    model="gemini-2.5-flash-preview-05-20",
                    contents=contents,
                    config=config,
                )

                if response.candidates:
                    for candidate in response.candidates:
                        if candidate.content and candidate.content.parts:
                            for part in candidate.content.parts:
                                if hasattr(part, "inline_data") and part.inline_data:
                                    inline = part.inline_data
                                    if hasattr(inline, "data") and inline.data:
                                        composed.append({
                                            "scene_id": selection["scene_id"],
                                            "image_data": base64.b64encode(inline.data).decode("utf-8"),
                                            "mime_type": detect_mime_type(inline.data),
                                            "selection": selection,
                                        })
                                        break

            if not composed:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"detail": "Failed to compose images"}).encode())
                return

            stats["steps"]["4_compose"] = {"elapsed": round(time.time() - step_start, 3), "count": len(composed)}

            # === Step 5: Generate Masks ===
            step_start = time.time()
            placements = []

            for comp in composed:
                product = next((p for p in products if p["id"] == comp["selection"]["selected_product_id"]), None)
                if not product:
                    continue

                prompt = MASK_PROMPT.format(product_name=product.get("name", "product"))

                image_data = base64.b64decode(comp["image_data"])
                parts = [
                    types.Part.from_text(text=prompt),
                    types.Part.from_bytes(data=image_data, mime_type=comp["mime_type"]),
                ]
                contents = [types.Content(role="user", parts=parts)]
                config = types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"])

                response = client.models.generate_content(
                    model="gemini-2.5-flash-preview-05-20",
                    contents=contents,
                    config=config,
                )

                mask_data = None
                mask_mime = "image/png"

                if response.candidates:
                    for candidate in response.candidates:
                        if candidate.content and candidate.content.parts:
                            for part in candidate.content.parts:
                                if hasattr(part, "inline_data") and part.inline_data:
                                    inline = part.inline_data
                                    if hasattr(inline, "data") and inline.data:
                                        mask_data = base64.b64encode(inline.data).decode("utf-8")
                                        mask_mime = detect_mime_type(inline.data)
                                        break

                if not mask_data:
                    continue

                # Get scene info
                scene = next((s for s in scenes if s["id"] == comp["scene_id"]), None)
                scene_img = next((i for i in images if i["scene_id"] == comp["scene_id"]), None)

                if scene and scene_img:
                    placements.append({
                        "scene_id": comp["scene_id"],
                        "scene_description": scene["description"],
                        "mood": scene["mood"],
                        "scene_type": scene["scene_type"],
                        "scene_image": scene_img["image_data"],
                        "composed_image": comp["image_data"],
                        "mask": mask_data,
                        "mime_type": comp["mime_type"],
                        "product": product,
                        "placement_hint": comp["selection"]["placement_hint"],
                        "rationale": comp["selection"]["rationale"],
                    })

            stats["steps"]["5_masks"] = {"elapsed": round(time.time() - step_start, 3), "count": len(placements)}
            stats["total_elapsed"] = round(time.time() - pipeline_start, 3)
            stats["placements_generated"] = len(placements)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"placements": placements, "stats": stats}).encode())

        except Exception as e:
            self.send_response(503)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"detail": f"Pipeline failed: {str(e)}"}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
