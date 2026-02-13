#!/usr/bin/env python3
import argparse
import json
import os
import platform
from http.server import BaseHTTPRequestHandler, HTTPServer


def _build_health_payload():
    payload = {
        "status": "ok",
        "service": "python-sidecar",
        "pythonVersion": platform.python_version(),
        "pymupdfAvailable": False,
    }
    try:
        import fitz  # type: ignore

        payload["pymupdfAvailable"] = True
        payload["pymupdfVersion"] = getattr(fitz, "VersionBind", None)
    except Exception as error:  # pragma: no cover - diagnostics only
        payload["pymupdfError"] = str(error)

    return payload


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/health":
            self.send_response(404)
            self.end_headers()
            return

        payload = _build_health_payload()
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_POST(self):
        if self.path != "/inspect-pdf":
            self.send_response(404)
            self.end_headers()
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            request_body = self.rfile.read(content_length).decode("utf-8")
            payload = json.loads(request_body) if request_body else {}
            file_path = payload.get("filePath")
            if not isinstance(file_path, str) or not file_path:
                raise ValueError("filePath is required")

            with open(file_path, "rb") as stream:
                header = stream.read(5)

            result = _build_health_payload()
            result.update(
                {
                    "accepted": header == b"%PDF-",
                    "fileName": os.path.basename(file_path),
                    "fileSizeBytes": os.path.getsize(file_path),
                    "headerHex": header.hex(),
                    "message": "PDF inspected by python sidecar.",
                }
            )

            encoded = json.dumps(result).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)
        except Exception as error:
            encoded = json.dumps({"message": str(error)}).encode("utf-8")
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

    def log_message(self, _format, *_args):
        return


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=43124)
    args = parser.parse_args()

    server = HTTPServer((args.host, args.port), _Handler)
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
