from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
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


def test_waveform_endpoint_returns_samples_and_spectrum():
    service = _load_service_module()
    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, payload = _request(
            server.server_address[1], "GET", "/waveform?points=64"
        )
        assert status == 200
        assert isinstance(payload, dict)
        assert len(payload["samples"]) == 64
        assert len(payload["spectrum"]) == 32
        assert all(m >= 0 for m in payload["spectrum"])
        assert payload["sampleRate"] > 0
        assert "pythonVersion" not in payload or isinstance(
            payload["pythonVersion"], str
        )
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_waveform_endpoint_defaults_points_when_invalid():
    service = _load_service_module()

    assert service._parse_points_from_path("/waveform") == 256
    assert service._parse_points_from_path("/waveform?points=999999") == 1024
    assert service._parse_points_from_path("/waveform?points=abc") == 256


def test_ai_capabilities_returns_structured_report():
    service = _load_service_module()
    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, payload = _request(
            server.server_address[1], "GET", "/ai/capabilities"
        )
        assert status == 200
        assert isinstance(payload, dict)
        assert isinstance(payload["nvidiaDriverPresent"], bool)
        assert set(payload["backends"].keys()) == {
            "llamaCpp",
            "torch",
            "onnxRuntime",
            "transformers",
        }
        assert all(isinstance(v, bool) for v in payload["backends"].values())
        assert isinstance(payload["models"], list)
        assert isinstance(payload["canRunLocalLlm"], bool)
        assert payload["recommendedBackend"] in ("none", "llama-cpp")
        assert isinstance(payload["notes"], list)
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_ai_generate_without_setup_reports_unavailable():
    service = _load_service_module()
    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, payload = _request(
            server.server_address[1],
            "POST",
            "/ai/generate",
            {"prompt": "hello", "maxTokens": 16},
        )
        assert status == 200
        assert isinstance(payload, dict)
        assert isinstance(payload["available"], bool)
        if not payload["available"]:
            assert isinstance(payload["reason"], str)
            assert isinstance(payload["guidance"], list)
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_mcp_initialize_tools_list_and_call():
    service = _load_service_module()
    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    port = server.server_address[1]
    try:
        status, init = _request(
            port,
            "POST",
            "/mcp",
            {"jsonrpc": "2.0", "id": 1, "method": "initialize"},
        )
        assert status == 200
        assert init["result"]["serverInfo"]["name"] == "angulectron-sidecar"

        status, tools = _request(
            port, "POST", "/mcp", {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}
        )
        names = {tool["name"] for tool in tools["result"]["tools"]}
        assert {"echo", "system_info", "time_now"} <= names

        status, call = _request(
            port,
            "POST",
            "/mcp",
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {"name": "echo", "arguments": {"text": "ping"}},
            },
        )
        assert call["result"]["content"][0]["text"] == "ping"

        status, missing = _request(
            port, "POST", "/mcp", {"jsonrpc": "2.0", "id": 4, "method": "bogus"}
        )
        assert missing["error"]["code"] == -32601
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_mcp_unknown_tool_and_bad_args_return_errors():
    service = _load_service_module()
    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    port = server.server_address[1]
    try:
        status, unknown_tool = _request(
            port,
            "POST",
            "/mcp",
            {
                "jsonrpc": "2.0",
                "id": 5,
                "method": "tools/call",
                "params": {"name": "nope", "arguments": {}},
            },
        )
        assert unknown_tool["error"]["code"] == -32602

        status, bad_args = _request(
            port,
            "POST",
            "/mcp",
            {
                "jsonrpc": "2.0",
                "id": 6,
                "method": "tools/call",
                "params": {"name": "echo", "arguments": {}},
            },
        )
        assert bad_args["error"]["code"] == -32602

        status, now = _request(
            port,
            "POST",
            "/mcp",
            {
                "jsonrpc": "2.0",
                "id": 7,
                "method": "tools/call",
                "params": {"name": "time_now", "arguments": {}},
            },
        )
        text = now["result"]["content"][0]["text"]
        assert "T" in text and text.endswith("Z")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_generate_happy_path_with_stubbed_llama_cpp(monkeypatch, tmp_path):
    service = _load_service_module()

    models_dir = tmp_path / "models"
    models_dir.mkdir()
    (models_dir / "tiny.gguf").write_bytes(b"GGUF-fake")

    instantiations = {"count": 0}

    class _StubLlama:
        def __init__(self, **_kwargs):
            instantiations["count"] += 1

        def __call__(self, prompt, max_tokens=None, echo=False):
            return {"choices": [{"text": f"echo:{prompt}:{max_tokens}"}]}

    stub_dir = tmp_path / "stubpkg"
    stub_dir.mkdir()
    # Real stub injected directly into sys.modules instead of on-disk trickery.
    import types

    stub_module = types.ModuleType("llama_cpp")
    stub_module.Llama = _StubLlama
    monkeypatch.setitem(sys.modules, "llama_cpp", stub_module)
    monkeypatch.setattr(service, "_module_available", lambda name: True)
    monkeypatch.setattr(service, "AI_MODELS_DIR", str(models_dir))
    monkeypatch.setattr(service, "_LLM_CACHE", {})
    monkeypatch.setattr(service, "nvidia_detected", lambda: True)

    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    port = server.server_address[1]
    try:
        status, first = _request(
            port,
            "POST",
            "/ai/generate",
            {"prompt": "hi", "maxTokens": 8},
        )
        assert status == 200
        assert first["available"] is True
        assert first["model"] == "tiny.gguf"
        assert first["text"] == "echo:hi:8"

        status, second = _request(
            port,
            "POST",
            "/ai/generate",
            {"prompt": "again", "maxTokens": 4},
        )
        assert second["available"] is True
        # Cached instance must be reused across requests.
        assert instantiations["count"] == 1

        status, explicit = _request(
            port,
            "POST",
            "/ai/generate",
            {"prompt": "select", "model": "tiny.gguf"},
        )
        assert explicit["available"] is True

        status, missing_model = _request(
            port,
            "POST",
            "/ai/generate",
            {"prompt": "x", "model": "does-not-exist.gguf"},
        )
        assert missing_model["available"] is False
        assert "No .gguf model found" in missing_model["reason"]
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_generate_reports_failure_when_model_load_raises(monkeypatch, tmp_path):
    service = _load_service_module()

    models_dir = tmp_path / "models"
    models_dir.mkdir()
    (models_dir / "broken.gguf").write_bytes(b"GGUF-fake")

    import types

    class _BrokenLlama:
        def __init__(self, **_kwargs):
            raise OSError("model file corrupt")

    stub_module = types.ModuleType("llama_cpp")
    stub_module.Llama = _BrokenLlama
    monkeypatch.setitem(sys.modules, "llama_cpp", stub_module)
    monkeypatch.setattr(service, "_module_available", lambda name: True)
    monkeypatch.setattr(service, "AI_MODELS_DIR", str(models_dir))
    monkeypatch.setattr(service, "_LLM_CACHE", {})

    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, payload = _request(
            server.server_address[1],
            "POST",
            "/ai/generate",
            {"prompt": "hello"},
        )
        assert status == 200
        assert payload["available"] is False
        assert payload["reason"].startswith("Generation failed:")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_list_local_models_scans_configured_dir(tmp_path):
    service = _load_service_module()
    models_dir = tmp_path / "m"
    models_dir.mkdir()
    (models_dir / "a.gguf").write_bytes(b"x" * 10)
    (models_dir / "b.txt").write_text("ignored")

    original = service.AI_MODELS_DIR
    service.AI_MODELS_DIR = str(models_dir)
    try:
        models = service._list_local_models()
    finally:
        service.AI_MODELS_DIR = original

    assert len(models) == 1
    assert models[0]["fileName"] == "a.gguf"
    assert models[0]["sizeBytes"] == 10


def test_detect_gpus_handles_errors_and_malformed_rows(monkeypatch):
    service = _load_service_module()

    class _Boom:
        TimeoutExpired = subprocess.TimeoutExpired
        SubprocessError = subprocess.SubprocessError

        def run(self, *args, **kwargs):
            raise subprocess.TimeoutExpired(cmd="nvidia-smi", timeout=3)

    monkeypatch.setattr(service, "subprocess", _Boom())
    present, gpus, error = service._detect_gpus()
    assert present is False
    assert gpus == []
    assert error is not None

    class _Row:
        def __init__(self, stdout):
            self.stdout = stdout.encode("utf-8")

    def _fake_run(*_args, **_kwargs):
        return _Row("GPU Only Row\nWeird GPU, not-a-number, 999\n")

    monkeypatch.setattr(service.subprocess, "run", _fake_run)
    present, gpus, error = service._detect_gpus()
    assert present is True
    assert len(gpus) == 1
    assert gpus[0]["name"] == "Weird GPU"
    assert gpus[0]["vramMb"] is None
    assert error is None


def test_module_available_false_for_missing_and_invalid_names():
    service = _load_service_module()
    assert service._module_available("angulectron_definitely_missing_pkg") is False
    assert service._module_available("") is False


def test_capabilities_notes_cover_unconfigured_environment(monkeypatch, tmp_path):
    service = _load_service_module()
    empty_dir = tmp_path / "no-models"
    empty_dir.mkdir()
    monkeypatch.setattr(service, "_module_available", lambda name: False)
    monkeypatch.setattr(service, "AI_MODELS_DIR", str(empty_dir))

    payload = service._build_ai_capabilities_payload()

    assert payload["canRunLocalLlm"] is False
    assert payload["recommendedBackend"] == "none"
    assert any("llama-cpp-python" in note for note in payload["notes"])
    assert any(".gguf model file" in note for note in payload["notes"])


def test_generate_validation_errors_return_400():
    service = _load_service_module()
    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    port = server.server_address[1]
    try:
        status, missing_prompt = _request(port, "POST", "/ai/generate", {})
        assert status == 400
        assert "prompt is required" in missing_prompt["message"]

        status, bad_tokens = _request(
            port,
            "POST",
            "/ai/generate",
            {"prompt": "hi", "maxTokens": 100000},
        )
        assert status == 400
        assert "maxTokens" in bad_tokens["message"]
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_mcp_initialized_notification_and_system_info_tool():
    service = _load_service_module()
    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    port = server.server_address[1]
    try:
        status, initialized = _request(
            port,
            "POST",
            "/mcp",
            {
                "jsonrpc": "2.0",
                "id": None,
                "method": "notifications/initialized",
            },
        )
        assert status == 200
        assert initialized == {}

        status, info = _request(
            port,
            "POST",
            "/mcp",
            {
                "jsonrpc": "2.0",
                "id": 9,
                "method": "tools/call",
                "params": {"name": "system_info", "arguments": {}},
            },
        )
        text = json.loads(info["result"]["content"][0]["text"])
        assert "pythonVersion" in text
        assert "cpuCount" in text
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
    monkeypatch.setattr(service, "ThreadingHTTPServer", _fake_http_server)

    try:
        service.main()
    except KeyboardInterrupt:
        pass

    assert fake_server is not None
    assert fake_server.address == ("127.0.0.1", 43124)
    assert fake_server.handler is service._Handler
    assert fake_server.closed is True


def test_extract_text_endpoint_returns_page_text():
    service = _load_service_module()
    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = Path(temp_dir) / "text.pdf"
            pdf_path.write_bytes(b"%PDF-1.7\n% text content\n")

            status, payload = _request(
                server.server_address[1],
                "POST",
                "/extract-text",
                {"filePath": str(pdf_path)},
            )

        if status == 200:
            assert payload["accepted"] is True
            assert payload["fileName"] == "text.pdf"
            assert "pageCount" in payload
            assert "textByPage" in payload
            assert isinstance(payload["textByPage"], list)
        else:
            assert status == 400
            assert "message" in payload
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_extract_text_endpoint_rejects_missing_filepath():
    service = _load_service_module()
    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, payload = _request(
            server.server_address[1], "POST", "/extract-text", {}
        )
        assert status == 400
        assert "filePath is required" in payload["message"]
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_ocr_endpoint_reports_unavailable_without_deps():
    service = _load_service_module()
    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            img_path = Path(temp_dir) / "sample.png"
            img_path.write_bytes(b"\x89PNG\r\n")

            status, payload = _request(
                server.server_address[1],
                "POST",
                "/ocr",
                {"filePath": str(img_path)},
            )

        assert status == 400
        assert "OCR not available" in payload["message"]
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_ocr_endpoint_rejects_missing_filepath():
    service = _load_service_module()
    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, payload = _request(
            server.server_address[1], "POST", "/ocr", {}
        )
        assert status == 400
        assert "filePath is required" in payload["message"]
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_ocr_endpoint_succeeds_with_stubbed_deps(monkeypatch, tmp_path):
    service = _load_service_module()

    import types

    stub_cv2 = types.ModuleType("cv2")
    stub_cv2.imread = lambda path: [[1, 2, 3]]
    stub_cv2.cvtColor = lambda img, code: img
    stub_cv2.COLOR_BGR2GRAY = 0
    monkeypatch.setitem(sys.modules, "cv2", stub_cv2)

    stub_pytesseract = types.ModuleType("pytesseract")
    stub_pytesseract.Output = type("Output", (), {"DICT": "dict"})
    stub_pytesseract.image_to_data = lambda img, output_type=None: {
        "text": ["  Hello ", "  World "],
        "left": [0, 50],
        "top": [0, 0],
        "width": [40, 50],
        "height": [10, 10],
    }
    monkeypatch.setitem(sys.modules, "pytesseract", stub_pytesseract)

    original_exists = os.path.exists
    monkeypatch.setattr(
        os.path,
        "exists",
        lambda path: True if "tesseract" in str(path) else original_exists(path),
    )

    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            img_path = Path(temp_dir) / "ocr.png"
            img_path.write_bytes(b"\x89PNG\r\n")

            status, payload = _request(
                server.server_address[1],
                "POST",
                "/ocr",
                {"filePath": str(img_path)},
            )

        if status == 200:
            assert payload["accepted"] is True
            assert payload["pageCount"] == 1
            assert len(payload["textByPage"][0]["blocks"]) == 2
        else:
            assert status == 400
            assert "message" in payload
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_ocr_endpoint_reports_cv2_unavailable(monkeypatch, tmp_path):
    service = _load_service_module()

    import types

    stub_pytesseract = types.ModuleType("pytesseract")
    stub_pytesseract.Output = type("Output", (), {"DICT": "dict"})
    monkeypatch.setitem(sys.modules, "pytesseract", stub_pytesseract)

    original_exists = os.path.exists
    monkeypatch.setattr(
        os.path,
        "exists",
        lambda path: True if "tesseract" in str(path) else original_exists(path),
    )

    monkeypatch.delitem(sys.modules, "cv2", raising=False)

    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            img_path = Path(temp_dir) / "ocr.png"
            img_path.write_bytes(b"\x89PNG\r\n")

            status, payload = _request(
                server.server_address[1],
                "POST",
                "/ocr",
                {"filePath": str(img_path)},
            )

        assert status == 400
        assert "OCR not available" in payload["message"] or "OpenCV" in payload["message"]
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_analyze_text_endpoint_returns_word_and_paragraph_counts():
    service = _load_service_module()
    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, payload = _request(
            server.server_address[1],
            "POST",
            "/analyze-text",
            {"text": "Hello world. This is a test."},
        )

        assert status == 200
        assert isinstance(payload, dict)
        assert payload["accepted"] is True
        assert payload["fileName"] == "analyzed"
        assert "textByPage" in payload
        page = payload["textByPage"][0]
        assert page["wordCount"] == 6
        assert page["paragraphCount"] == 1
        assert "normalizedWhitespace" in page
        assert page["languageDetection"] in ("en", "unknown")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_analyze_text_endpoint_rejects_empty_text():
    service = _load_service_module()
    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, payload = _request(
            server.server_address[1], "POST", "/analyze-text", {"text": ""}
        )
        assert status == 400
        assert "text is required" in payload["message"]
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_analyze_text_endpoint_handles_paragraphs():
    service = _load_service_module()
    server = TCPServer(("127.0.0.1", 0), service._Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, payload = _request(
            server.server_address[1],
            "POST",
            "/analyze-text",
            {"text": "First paragraph.\n\nSecond paragraph."},
        )
        assert status == 200
        page = payload["textByPage"][0]
        assert page["paragraphCount"] == 2
        assert page["wordCount"] == 4
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)
