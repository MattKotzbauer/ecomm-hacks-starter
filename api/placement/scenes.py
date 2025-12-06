"""Generate scene descriptions from writing context."""

import json
import os
import re
from http.server import BaseHTTPRequestHandler

from google import genai
from google.genai import types


# Prompt template
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
  Match their moods, settings, and aesthetic direction. Give the user more of what they like.
- {exploration_count} EXPLORATION scenes: These should explore DIFFERENT directions.
  Vary lighting, setting, mood, or atmosphere from what the user has liked.

Requirements:
1. Each scene must be vivid and detailed for AI image generation
2. Suitable for placing luxury products naturally
3. CONTINUATION scenes feel cohesive with liked scenes
4. EXPLORATION scenes introduce fresh variety

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


def build_liked_scenes_section(liked_scenes: list) -> str:
    """Build XML section for liked scenes."""
    if not liked_scenes:
        return "<liked_scenes>\n(No liked scenes yet - generate all as exploration)\n</liked_scenes>"

    scenes_xml = []
    for scene in liked_scenes:
        product_line = f"    <product>{scene.get('product_name', '')}</product>" if scene.get('product_name') else ""
        scenes_xml.append(
            f'  <scene mood="{scene.get("mood", "")}">\n'
            f"    <description>{scene.get('description', '')}</description>\n"
            f"{product_line}\n"
            f"  </scene>"
        )

    return f"<liked_scenes>\n{''.join(scenes_xml)}\n</liked_scenes>"


def parse_scenes_xml(text: str) -> list:
    """Parse XML response into scene objects."""
    scenes = []
    scene_pattern = r'<scene id="(\d+)"(?: type="(continuation|exploration)")?\s*>\s*<description>(.*?)</description>\s*<mood>(.*?)</mood>\s*</scene>'
    matches = re.findall(scene_pattern, text, re.DOTALL)

    for match in matches:
        scene_id, scene_type, description, mood = match
        scenes.append({
            "id": f"scene-{scene_id}",
            "description": description.strip(),
            "mood": mood.strip(),
            "scene_type": scene_type.strip() if scene_type else "exploration",
        })

    return scenes


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Read request body
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            # Get API key
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"detail": "GEMINI_API_KEY not configured"}).encode())
                return

            # Parse request
            writing_context = data.get("writing_context", "")
            liked_scenes = data.get("liked_scenes", [])
            continuation_count = data.get("continuation_count", 3)
            exploration_count = data.get("exploration_count", 2)
            total_count = continuation_count + exploration_count

            # Build prompt
            liked_section = build_liked_scenes_section(liked_scenes)
            prompt = SCENES_PROMPT.format(
                writing_context=writing_context,
                liked_scenes_section=liked_section,
                total_count=total_count,
                continuation_count=continuation_count,
                exploration_count=exploration_count,
            )

            # Call Gemini
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model="gemini-2.5-flash-preview-05-20",
                contents=prompt,
            )

            # Parse response
            scenes = parse_scenes_xml(response.text)

            if not scenes:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"detail": "Failed to parse scene descriptions"}).encode())
                return

            # Return success
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"scenes": scenes}).encode())

        except Exception as e:
            self.send_response(503)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"detail": f"Scene generation failed: {str(e)}"}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
