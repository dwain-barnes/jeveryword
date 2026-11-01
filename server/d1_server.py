"""Serves LiquidAI/d1-2B on this machine in the shape jeveryword sends:
POST /v1/systemone {"state": ..., "questions": {...}} -> {"answers": {...}, "usage": {...}}
"""

import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

# Must be set before transformers is imported. Download the model once, then nothing goes out.
os.environ.setdefault("HF_HUB_OFFLINE", "1")

import torch
from transformers import AutoModel

MODEL = "LiquidAI/d1-2B"
# d1 runs its own Python code from the model repo, so pin the commit that was read and tested.
REVISION = os.environ.get("D1_REVISION", "97c57047d5852d77e02dfac211f8768aff77a8b2")
PORT = int(os.environ.get("D1_PORT", "8411"))
MAX_BODY = 1_000_000


def load():
    if torch.cuda.is_available():
        device = "cuda"
    elif torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"
    dtype = torch.float32 if device == "cpu" else torch.bfloat16
    return AutoModel.from_pretrained(MODEL, revision=REVISION, trust_remote_code=True, dtype=dtype).to(device)


class Handler(BaseHTTPRequestHandler):
    timeout = 30  # drops a client that stalls mid-request; inference itself is not limited

    def do_POST(self):
        if self.path != "/v1/systemone":
            return self.reply(404, {"error": "not_found"})
        length = self.headers.get("Content-Length", "")
        if not length.isdigit():
            return self.reply(411, {"error": "length_required"})
        if int(length) > MAX_BODY:
            return self.reply(413, {"error": "max_tokens_exceeded"})
        try:
            req = json.loads(self.rfile.read(int(length)))
        except ValueError:
            return self.reply(400, {"error": "invalid_json"})
        if not isinstance(req, dict) or "state" not in req or not isinstance(req.get("questions"), dict):
            return self.reply(400, {"error": "expected {state, questions}"})
        try:
            out = self.server.model.system_one(req["state"], req["questions"])
        except ValueError as e:
            # d1's message says which question is malformed and how; it never quotes the state.
            return self.reply(400, {"error": str(e)})
        self.reply(200, {"model": "d1-2B", **out})

    def reply(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    server.model = load()
    print(f"d1-2B ready on http://127.0.0.1:{PORT}/v1/systemone", flush=True)
    server.serve_forever()
