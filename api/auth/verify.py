"""Vercel Serverless Function: Password verification."""

import json
import os
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Get password from environment variable
            correct_password = os.environ.get("SITE_PASSWORD", "")

            if not correct_password:
                self._send_json(500, {"success": False, "error": "Password not configured"})
                return

            # Parse request body
            content_length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(content_length))

            submitted_password = body.get("password", "")

            # Verify password
            if submitted_password == correct_password:
                self._send_json(200, {"success": True})
            else:
                self._send_json(401, {"success": False, "error": "Incorrect password"})

        except Exception as e:
            self._send_json(500, {"success": False, "error": str(e)})

    def _send_json(self, status: int, data: dict):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
