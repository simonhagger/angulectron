from __future__ import annotations

import importlib.util
import json
import tempfile
import threading
from http.client import HTTPConnection
from pathlib import Path
from socketserver import TCPServer
from typing import Any


def _load_service_module():
    service_path = (
        Path(__file__).resolve().parents[2]
        / "src"
        / "assets"
        / "python_sidecar"
        / "service.py"
    )
    spec = importlib.util.spec_from_file_location("python_sidecar_service", service_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _request(
    port: int,
    method: str,
    path: str,
    payload: dict[str, Any] | None = None,
) -> tuple[int, dict[str, Any] | str]:
    conn = HTTPConnection("127.0.0.1", port, timeout=3)
    headers = {}
    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    conn.request(method, path, body=body, headers=headers)
    response = conn.getresponse()
    raw = response.read().decode("utf-8")
    conn.close()
    try:
        return response.status, json.loads(raw)
    except json.JSONDecodeError:
        return response.status, raw


def test_build_health_payload_contains_core_diagnostics():
    service = _load_service_module()

    payload = service._build_health_payload()

    assert payload["status"] == "ok"
    assert payload["service"] == "python-sidecar"
    assert "pythonVersion" in payload
    assert "pythonExecutable" in payload
    assert isinstance(payload["pythonExecutable"], str)
    assert isinstance(payload["pymupdfAvailable"], bool)


def test_health_endpoint_returns_ok_payload():
    service = _load_service_module()
    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, payload = _request(server.server_address[1], "GET", "/health")
        assert status == 200
        assert isinstance(payload, dict)
        assert payload["status"] == "ok"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_inspect_pdf_endpoint_accepts_safe_pdf_file():
    service = _load_service_module()
    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = Path(temp_dir) / "sample.pdf"
            pdf_path.write_bytes(b"%PDF-1.7\n% safe\n")

            status, payload = _request(
                server.server_address[1],
                "POST",
                "/inspect-pdf",
                {"filePath": str(pdf_path)},
            )

        assert status == 200
        assert isinstance(payload, dict)
        assert payload["accepted"] is True
        assert payload["fileName"] == "sample.pdf"
        assert payload["headerHex"] == "255044462d"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_inspect_pdf_endpoint_rejects_missing_filepath():
    service = _load_service_module()
    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, payload = _request(server.server_address[1], "POST", "/inspect-pdf", {})
        assert status == 400
        assert isinstance(payload, dict)
        assert "filePath is required" in payload["message"]
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_unknown_paths_return_404():
    service = _load_service_module()
    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        get_status, _ = _request(server.server_address[1], "GET", "/unknown")
        post_status, _ = _request(server.server_address[1], "POST", "/unknown", {})
        assert get_status == 404
        assert post_status == 404
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_main_initializes_server_and_closes_on_shutdown(monkeypatch):
    service = _load_service_module()

    class _FakeServer:
        def __init__(self, address, handler):
            self.address = address
            self.handler = handler
            self.closed = False

        def serve_forever(self):
            raise KeyboardInterrupt("stop server")

        def server_close(self):
            self.closed = True

    class _Args:
        host = "127.0.0.1"
        port = 43124

    fake_server: _FakeServer | None = None

    def _fake_http_server(address, handler):
        nonlocal fake_server
        fake_server = _FakeServer(address, handler)
        return fake_server

    class _FakeParser:
        def add_argument(self, *_args, **_kwargs):
            return None

        def parse_args(self):
            return _Args()

    monkeypatch.setattr(service.argparse, "ArgumentParser", lambda: _FakeParser())
    monkeypatch.setattr(service, "HTTPServer", _fake_http_server)

    try:
        service.main()
    except KeyboardInterrupt:
        pass

    assert fake_server is not None
    assert fake_server.address == ("127.0.0.1", 43124)
    assert fake_server.handler is service._Handler
    assert fake_server.closed is True
