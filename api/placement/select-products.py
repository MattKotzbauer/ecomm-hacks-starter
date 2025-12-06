"""Select products for each generated image."""

import base64
import json
import os
import re
from http.server import BaseHTTPRequestHandler

from google import genai
from google.genai import types


SELECT_PROMPT = """<system>
You are a luxury product placement specialist and audience matching expert.
Your job is to select the most appropriate product for a given scene, considering both visual fit AND advertiser targeting preferences.
</system>

<writer_context>
{writing_context}
</writer_context>

<available_products>
{products_xml}
</available_products>

<instructions>
Analyze this lifestyle scene and the writer's context. Select ONE product that:

1. **Visual Fit**: Fits naturally in the scene's context, lighting, color palette, and mood
2. **Audience Match**: Aligns with the writer's implied interests and demographics based on their writing context
3. **Advertiser Targeting**: Matches the advertiser's targeting preferences (if specified):
   - demographics: Age ranges the advertiser wants to reach
   - interests: Topics/lifestyle categories the advertiser targets
   - scenes: Scene types the advertiser prefers
   - semantic: Custom criteria from the advertiser

**Matching Logic**:
- If a product has targeting preferences, check if the writer's context suggests they fit the target audience
- A writer discussing "minimalist interior design" matches interests like [Minimalist, Home, Design]
- A writer discussing "extreme sports adventures" does NOT match interests like [Luxury, Fashion]
- If NO products have a reasonable match, select "NONE" - it's better to show nothing than a mismatched ad

Consider where the product would naturally appear in this scene.
</instructions>

<output_format>
<selection>
  <product_id>selected product id OR "NONE" if no good match</product_id>
  <placement>specific location in scene (or "N/A" if NONE)</placement>
  <rationale>Write a flowing, cohesive paragraph (3-5 sentences) that naturally weaves together the scene's aesthetic, why this product is the strongest visual match, how it complements the environment, and why it appeals to the target audience. Do NOT use markdown formatting, bullet points, or labeled sections like "VISUAL FIT:" - write as elegant prose.</rationale>
  <match_score>1-10 confidence score for audience match</match_score>
</selection>
</output_format>
"""


def build_products_xml(products: list) -> str:
    """Build XML representation of products."""
    product_xmls = []
    for p in products:
        targeting_lines = []
        if p.get("target_demographics"):
            targeting_lines.append(
                f"    <demographics>{', '.join(p['target_demographics'])}</demographics>"
            )
        if p.get("target_interests"):
            targeting_lines.append(
                f"    <interests>{', '.join(p['target_interests'])}</interests>"
            )
        if p.get("scene_preferences"):
            targeting_lines.append(
                f"    <scenes>{', '.join(p['scene_preferences'])}</scenes>"
            )
        if p.get("semantic_filter"):
            targeting_lines.append(f"    <semantic>{p['semantic_filter']}</semantic>")

        targeting_section = ""
        if targeting_lines:
            targeting_section = (
                "\n  <targeting>\n" + "\n".join(targeting_lines) + "\n  </targeting>"
            )

        product_xml = (
            f'<product id="{p.get("id", "")}" brand="{p.get("brand", "")}">\n'
            f"  <name>{p.get('name', '')}</name>\n"
            f"  <description>{p.get('description', 'Luxury product')}</description>"
            f"{targeting_section}\n"
            f"</product>"
        )
        product_xmls.append(product_xml)

    return "\n".join(product_xmls)


def parse_selection_xml(text: str, scene_id: str) -> dict:
    """Parse XML response into selection object."""
    product_id_match = re.search(r"<product_id>(.*?)</product_id>", text, re.DOTALL)
    placement_match = re.search(r"<placement>(.*?)</placement>", text, re.DOTALL)
    rationale_match = re.search(r"<rationale>(.*?)</rationale>", text, re.DOTALL)
    match_score_match = re.search(r"<match_score>(.*?)</match_score>", text, re.DOTALL)

    if not all([product_id_match, placement_match, rationale_match]):
        raise ValueError("Failed to parse product selection XML")

    match_score = 5
    if match_score_match:
        try:
            match_score = int(match_score_match.group(1).strip())
            match_score = max(1, min(10, match_score))
        except ValueError:
            pass

    return {
        "scene_id": scene_id,
        "selected_product_id": product_id_match.group(1).strip(),
        "placement_hint": placement_match.group(1).strip(),
        "rationale": rationale_match.group(1).strip(),
        "match_score": match_score,
    }


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

            images = data.get("images", [])
            products = data.get("products", [])
            writing_context = data.get("writing_context", "")

            if not images or not products:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"detail": "Images and products are required"}).encode())
                return

            client = genai.Client(api_key=api_key)
            products_xml = build_products_xml(products)
            selections = []

            for img in images:
                prompt = SELECT_PROMPT.format(
                    writing_context=writing_context or "(No writing context provided)",
                    products_xml=products_xml,
                )

                # Decode image
                image_data = base64.b64decode(img.get("image_data", ""))
                mime_type = img.get("mime_type", "image/jpeg")

                # Build content with image
                parts = [
                    types.Part.from_text(text=prompt),
                    types.Part.from_bytes(data=image_data, mime_type=mime_type),
                ]
                contents = [types.Content(role="user", parts=parts)]

                response = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=contents,
                )

                selection = parse_selection_xml(response.text, img.get("scene_id", ""))
                selections.append(selection)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"selections": selections}).encode())

        except Exception as e:
            self.send_response(503)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"detail": f"Product selection failed: {str(e)}"}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
