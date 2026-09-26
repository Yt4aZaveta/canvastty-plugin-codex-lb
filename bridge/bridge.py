"""Loopback-only CORS bridge for the codex-lb fleet summary."""

from http.client import HTTPConnection, HTTPException
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


HOST = "127.0.0.1"
PORT = 2456
UPSTREAM_PORT = 2455
PATH = "/api/fleet/summary"
MAX_RESPONSE_BYTES = 2 * 1024 * 1024


class Handler(BaseHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass

    def respond(self, status, body=b""):
        self.send_response(status)
        if self.headers.get("Origin") == "null":
            self.send_header("Access-Control-Allow-Origin", "null")
        self.send_header("Vary", "Origin")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def allowed(self):
        if self.path != PATH:
            self.respond(404)
            return False
        if self.headers.get("Origin") not in (None, "null"):
            self.respond(403)
            return False
        return True

    def do_OPTIONS(self):
        if not self.allowed():
            return
        if self.headers.get("Origin") != "null" or self.headers.get("Access-Control-Request-Method") != "GET":
            self.respond(403)
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "null")
        self.send_header("Access-Control-Allow-Methods", "GET")
        self.send_header("Access-Control-Allow-Headers", "Authorization")
        if self.headers.get("Access-Control-Request-Private-Network") == "true":
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Vary", "Origin")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if not self.allowed():
            return
        connection = HTTPConnection(HOST, UPSTREAM_PORT, timeout=10)
        try:
            connection.request("GET", PATH, headers={
                "Authorization": self.headers.get("Authorization", ""),
                "Accept": "application/json",
            })
            response = connection.getresponse()
            body = response.read(MAX_RESPONSE_BYTES + 1)
            if len(body) > MAX_RESPONSE_BYTES:
                self.respond(502, b'{"error":"Upstream response is too large"}')
            else:
                self.respond(response.status, body)
        except (OSError, HTTPException):
            self.respond(502, b'{"error":"codex-lb is unavailable"}')
        finally:
            connection.close()


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"CanvasTTY codex-lb bridge listening on http://{HOST}:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
