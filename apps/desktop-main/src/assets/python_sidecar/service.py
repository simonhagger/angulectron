#!/usr/bin/env python3
import argparse
import importlib.util
import json
import math
import re
import os
import platform
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

AI_MODELS_DIR = os.environ.get(
    "AI_MODELS_DIR",
    os.path.join(os.path.expanduser("~"), ".angulectron", "ai-models"),
)

_MCP_SERVER_INFO = {
    "name": "angulectron-sidecar",
    "version": "1.0.0",
}

_LLM_CACHE = {}


def _detect_gpus():
    try:
        raw = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=name,memory.total,driver_version",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            timeout=3,
            check=True,
        )
    except (OSError, subprocess.SubprocessError) as error:
        return False, [], str(error)

    gpus = []
    for line in raw.stdout.decode("utf-8", "replace").strip().splitlines():
        parts = [part.strip() for part in line.split(",")]
        if len(parts) < 3:
            continue
        try:
            vram_mb = int(parts[1])
        except ValueError:
            vram_mb = None
        gpus.append(
            {
                "name": parts[0],
                "vramMb": vram_mb,
                "driverVersion": parts[2],
            }
        )
    return len(gpus) > 0, gpus, None


def _total_memory_bytes():
    if sys.platform == "win32":
        import ctypes

        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong),
                ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong),
                ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong),
                ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong),
                ("ullAvailVirtual", ctypes.c_ulonglong),
                ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]

        stat = MEMORYSTATUSEX()
        stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
        try:
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))
            return int(stat.ullTotalPhys)
        except Exception:  # pragma: no cover - diagnostics only
            return None
    try:  # pragma: no cover - posix only
        return os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")
    except (ValueError, OSError, AttributeError):
        return None


def _module_available(name):
    try:
        return importlib.util.find_spec(name) is not None
    except (ImportError, ValueError):
        return False


def _list_local_models():
    models = []
    try:
        for entry in sorted(os.listdir(AI_MODELS_DIR)):
            if entry.lower().endswith(".gguf"):
                path = os.path.join(AI_MODELS_DIR, entry)
                try:
                    size = os.path.getsize(path)
                except OSError:
                    size = 0
                models.append({"fileName": entry, "sizeBytes": size})
    except OSError:
        pass
    return models[:10]


def _build_ai_capabilities_payload():
    nvidia_present, gpus, gpu_error = _detect_gpus()
    backends = {
        "llamaCpp": _module_available("llama_cpp"),
        "torch": _module_available("torch"),
        "onnxRuntime": _module_available("onnxruntime"),
        "transformers": _module_available("transformers"),
    }
    models = _list_local_models()
    can_run = backends["llamaCpp"] and len(models) > 0

    notes = []
    if not nvidia_present:
        notes.append(
            "No NVIDIA driver detected via nvidia-smi; local inference would be CPU-only."
        )
    else:
        notes.append("NVIDIA driver detected; CUDA-capable inference builds can use GPU layers.")
    if not backends["llamaCpp"]:
        notes.append("Install llama-cpp-python to enable local GGUF inference.")
    if not models:
        notes.append(
            "Place a .gguf model file in %s to enable generation." % AI_MODELS_DIR
        )

    return {
        "pythonVersion": platform.python_version(),
        "platform": platform.platform(),
        "cpuCount": os.cpu_count() or 0,
        "totalMemoryBytes": _total_memory_bytes(),
        "nvidiaDriverPresent": nvidia_present,
        "gpus": gpus,
        "gpuProbeError": gpu_error,
        "backends": backends,
        "modelsDir": AI_MODELS_DIR,
        "models": models,
        "canRunLocalLlm": can_run,
        "recommendedBackend": "llama-cpp" if can_run else "none",
        "notes": notes,
    }


def _run_generation(payload):
    prompt = payload.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise ValueError("prompt is required")

    max_tokens = payload.get("maxTokens", 128)
    if not isinstance(max_tokens, int) or max_tokens < 1 or max_tokens > 256:
        raise ValueError("maxTokens must be an integer between 1 and 256")

    if not _module_available("llama_cpp"):
        return {
            "available": False,
            "reason": "llama-cpp-python is not installed in the sidecar environment.",
            "guidance": [
                "Install with: pip install llama-cpp-python",
                "For NVIDIA GPUs use a CUDA build, e.g.: "
                "CMAKE_ARGS=\"-DGGML_CUDA=on\" pip install llama-cpp-python",
            ],
        }

    models = _list_local_models()
    requested_model = payload.get("model")
    model_entry = None
    if isinstance(requested_model, str):
        for candidate in models:
            if candidate["fileName"] == requested_model:
                model_entry = candidate
                break
    elif models:
        model_entry = models[0]

    if model_entry is None:
        return {
            "available": False,
            "reason": "No .gguf model found.",
            "guidance": [
                "Place a .gguf model into %s and retry." % AI_MODELS_DIR
            ],
        }

    started = time.time()
    try:
        from llama_cpp import Llama  # type: ignore

        cache_key = model_entry["fileName"]
        llm = _LLM_CACHE.get(cache_key)
        if llm is None:
            llm = Llama(
                model_path=os.path.join(AI_MODELS_DIR, model_entry["fileName"]),
                n_ctx=2048,
                n_gpu_layers=-1 if nvidia_detected() else 0,
                verbose=False,
            )
            _LLM_CACHE[cache_key] = llm

        output = llm(prompt, max_tokens=max_tokens, echo=False)
        text = output.get("choices", [{}])[0].get("text", "")
        return {
            "available": True,
            "model": model_entry["fileName"],
            "text": text,
            "elapsedMs": int((time.time() - started) * 1000),
        }
    except Exception as error:
        return {
            "available": False,
            "reason": "Generation failed: %s" % error,
            "guidance": [],
        }


def nvidia_detected():
    present, _, _ = _detect_gpus()
    return present


_MCP_TOOLS = [
    {
        "name": "echo",
        "description": "Echoes the provided text back to the caller.",
        "inputSchema": {
            "type": "object",
            "properties": {"text": {"type": "string"}},
            "required": ["text"],
        },
    },
    {
        "name": "system_info",
        "description": "Returns basic host system information from the Python sidecar.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "time_now",
        "description": "Returns the current UTC time in ISO-8601 format.",
        "inputSchema": {"type": "object", "properties": {}},
    },
]


def _mcp_call_tool(name, arguments):
    if name == "echo":
        text = arguments.get("text") if isinstance(arguments, dict) else None
        if not isinstance(text, str):
            raise ValueError("text must be a string")
        return text
    if name == "system_info":
        return json.dumps(
            {
                "pythonVersion": platform.python_version(),
                "platform": platform.platform(),
                "cpuCount": os.cpu_count() or 0,
            }
        )
    if name == "time_now":
        return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    raise KeyError(name)


def _handle_mcp_request(payload):
    method = payload.get("method")
    request_id = payload.get("id")

    def result(value):
        return {"jsonrpc": "2.0", "id": request_id, "result": value}

    def error(code, message):
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {"code": code, "message": message},
        }

    if method == "initialize":
        return result(
            {
                "protocolVersion": "2025-06-18",
                "capabilities": {"tools": {}},
                "serverInfo": _MCP_SERVER_INFO,
            }
        )
    if method == "notifications/initialized":
        return {}
    if method == "tools/list":
        return result({"tools": _MCP_TOOLS})
    if method == "tools/call":
        params = payload.get("params") or {}
        tool_name = params.get("name")
        arguments = params.get("arguments") or {}
        try:
            text = _mcp_call_tool(tool_name, arguments)
        except KeyError:
            return error(-32602, "Unknown tool: %s" % tool_name)
        except ValueError as value_error:
            return error(-32602, str(value_error))
        return result(
            {"content": [{"type": "text", "text": text}], "isError": False}
        )
    return error(-32601, "Method not found: %s" % method)


def _build_health_payload():
    payload = {
        "status": "ok",
        "service": "python-sidecar",
        "pythonVersion": platform.python_version(),
        "pythonExecutable": os.path.realpath(sys.executable),
        "pymupdfAvailable": False,
    }
    try:
        import fitz  # type: ignore  # pragma: no cover - optional dependency

        payload["pymupdfAvailable"] = True  # pragma: no cover - optional
        payload["pymupdfVersion"] = getattr(  # pragma: no cover - optional
            fitz, "VersionBind", None
        )
    except Exception as error:  # pragma: no cover - diagnostics only
        payload["pymupdfError"] = str(error)

    return payload


def _parse_points_from_path(path):
    # Path shape: /waveform or /waveform?points=<int>
    _, _, query = path.partition("?")
    for fragment in query.split("&"):
        key, _, value = fragment.partition("=")
        if key == "points":
            try:
                return max(64, min(1024, int(value)))
            except ValueError:
                return 256
    return 256


def _build_waveform_payload(points, phase_base):
    samples = []
    for index in range(points):
        t = index / points
        phase = phase_base + t * math.tau
        value = (
            math.sin(phase) * 0.55
            + math.sin(phase * 2.7 + 1.3) * 0.28
            + math.sin(phase * 5.1 + 0.4) * 0.17
        )
        samples.append(round(value, 6))

    spectrum = []
    for harmonic in range(1, 33):
        real = sum(
            sample * math.cos(math.tau * harmonic * i / points)
            for i, sample in enumerate(samples)
        )
        imag = sum(
            sample * math.sin(math.tau * harmonic * i / points)
            for i, sample in enumerate(samples)
        )
        magnitude = math.sqrt(real * real + imag * imag) / points
        spectrum.append(round(magnitude, 6))

    return {
        "samples": samples,
        "spectrum": spectrum,
        "sampleRate": 256,
        "generatedAt": time.time(),
        "message": "Synthetic waveform generated by python sidecar.",
    }


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            payload = _build_health_payload()
        elif self.path.split("?")[0] == "/waveform":
            points = _parse_points_from_path(self.path)
            payload = _build_waveform_payload(points, time.time() % math.tau)
        elif self.path == "/ai/capabilities":
            payload = _build_ai_capabilities_payload()
        else:
            self.send_response(404)
            self.end_headers()
            return

        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_POST(self):
        if self.path in ("/ai/generate", "/mcp"):
            try:
                content_length = int(self.headers.get("Content-Length", "0"))
                request_body = self.rfile.read(content_length).decode("utf-8")
                payload = json.loads(request_body) if request_body else {}
                if self.path == "/ai/generate":
                    status, body = 200, _run_generation(payload)
                else:
                    status, body = 200, _handle_mcp_request(payload)
            except ValueError as error:
                status, body = 400, {"message": str(error)}
            except Exception as error:  # pragma: no cover - safety net
                status, body = 500, {"message": str(error)}

            encoded = json.dumps(body).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)
            return

        if self.path not in ("/inspect-pdf", "/extract-text", "/ocr", "/analyze-text"):
            self.send_response(404)
            self.end_headers()
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            request_body = self.rfile.read(content_length).decode("utf-8")
            payload = json.loads(request_body) if request_body else {}
            file_path = payload.get("filePath")

            if self.path == "/extract-text":
                if not isinstance(file_path, str) or not file_path:
                    raise ValueError("filePath is required")
                import fitz  # type: ignore  # optional dependency
                text_parts = []
                with fitz.open(file_path) as doc:
                    for page_num in range(doc.page_count):
                        page = doc[page_num]
                        text = page.get_text("text") or ""
                        text_parts.append({"page": page_num + 1, "text": text})
                result = {
                    "accepted": True,
                    "fileName": os.path.basename(file_path),
                    "fileSizeBytes": os.path.getsize(file_path),
                    "pageCount": doc.page_count,
                    "textByPage": text_parts,
                    "message": "PDF text extracted by python sidecar.",
                }
                encoded = json.dumps(result).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(encoded)))
                self.end_headers()
                self.wfile.write(encoded)
                return

            if self.path == "/ocr":
                if not isinstance(file_path, str) or not file_path:
                    raise ValueError("filePath is required")
                pytesseract_available = False
                try:
                    import pytesseract  # type: ignore  # optional dependency
                    pytesseract_available = True
                except Exception:
                    pass
                cv2_available = False
                try:
                    import cv2  # type: ignore  # optional dependency
                    cv2_available = True
                except Exception:
                    pass
                tesseract_cmd = None
                if sys.platform == "win32":
                    candidate = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
                    if os.path.exists(candidate):
                        tesseract_cmd = candidate
                else:
                    probe = subprocess.run(["which", "tesseract"], capture_output=True, text=True, timeout=2)
                    if probe.returncode == 0:
                        tesseract_cmd = probe.stdout.strip()
                if not pytesseract_available or not tesseract_cmd:
                    raise ImportError(
                        "OCR not available: pytesseract and/or tesseract binary not installed. "
                        "Install with: pip install pytesseract and apt-get install tesseract-ocr"
                    )
                if not cv2_available:
                    raise ImportError(
                        "OCR not available: OpenCV (cv2) is required but not installed. "
                        "Install with: pip install opencv-python"
                    )
                import pytesseract  # type: ignore  # now safe
                import cv2  # type: ignore  # now safe
                image = cv2.imread(file_path)
                if image is None:
                    raise ImportError("OpenCV (cv2) is required for OCR but not installed.")
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                data = pytesseract.image_to_data(gray, output_type=pytesseract.Output.DICT)
                text_by_block = []
                for i in range(len(data["text"])):
                    if data["text"][i].strip():
                        text_by_block.append({"page": 1, "left": data["left"][i], "top": data["top"][i], "width": data["width"][i], "height": data["height"][i], "text": data["text"][i]})
                result = {"accepted": True, "fileName": os.path.basename(file_path), "fileSizeBytes": os.path.getsize(file_path), "pageCount": 1, "textByPage": [{"page": 1, "blocks": text_by_block}], "message": "OCR completed by python sidecar."}
                encoded = json.dumps(result).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(encoded)))
                self.end_headers()
                self.wfile.write(encoded)
                return

            if self.path == "/analyze-text":
                text = payload.get("text")
                if not isinstance(text, str) or not text.strip():
                    raise ValueError("text is required")
                result = {
                    "accepted": True,
                    "fileName": "analyzed",
                    "fileSizeBytes": len(text.encode("utf-8")),
                    "pageCount": 1,
                    "textByPage": [{"page": 1, "text": text, "wordCount": len(text.split()), "paragraphCount": len([p for p in text.split("\n\n") if p.strip()]), "normalizedWhitespace": " ".join(text.split()), "languageDetection": "en" if re.search(r"\b(the|and|or|but|if|then|else|for|while|return)\b", text, re.IGNORECASE) else "unknown"}],
                    "message": "Text analyzed by python sidecar.",
                }
                encoded = json.dumps(result).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(encoded)))
                self.end_headers()
                self.wfile.write(encoded)
                return

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

    server = ThreadingHTTPServer((args.host, args.port), _Handler)
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":  # pragma: no cover
    main()
