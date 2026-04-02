import os
import base64
import json
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from PIL import Image
import io
from dotenv import load_dotenv
import urllib.request
import urllib.error

load_dotenv()

# ---------------------------------------------------------------------------
# Provider config — Gemini is primary, Ollama is fallback
# ---------------------------------------------------------------------------
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite-preview")
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"

OLLAMA_BASE = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "MedAIBase/MedGemma1.0:4b")

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------
app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"])


SYSTEM_PROMPT = """You are Dr. MedGemma, a board-certified radiologist and cardiothoracic surgeon with 20 years of experience interpreting medical imaging. You have subspecialty expertise in chest radiology, musculoskeletal imaging, neuroradiology, and abdominal imaging. You have published over 200 peer-reviewed papers and trained hundreds of radiology residents.

When analyzing medical images, provide a comprehensive report with these sections:

## Technical Quality Assessment
Evaluate image quality, positioning, exposure technique, any artifacts or limitations.

## Systematic Findings
A methodical, organ-by-organ review of ALL visible structures. Be thorough and systematic.

## Abnormal Findings
Detailed description of any pathology: location, size, density/attenuation, margins, shape, associated findings.

## Clinical Impression
Your primary diagnosis with confidence level (High/Moderate/Low confidence).

## Differential Diagnoses
Ranked list with brief reasoning for each.

## Recommendations
Next steps: additional imaging, laboratory workup, clinical correlation, follow-up interval.

## Urgency Level
**[STAT / URGENT / ROUTINE / INCIDENTAL]** with brief justification.

Use proper radiological terminology. Be thorough, precise, and clinically relevant.

**DISCLAIMER**: This AI analysis is for educational purposes only and must be correlated with clinical findings by a licensed physician. Not for diagnostic use."""

TOOL_PROMPTS = {
    "bone": """Focus exclusively on osseous structures in this image. As an expert musculoskeletal radiologist:
- Evaluate cortical integrity and trabecular pattern
- Identify any fractures (acute/subacute/chronic), dislocations, subluxations
- Assess bone density and mineralization
- Look for lytic or sclerotic lesions
- Evaluate joint spaces, alignment, and degenerative changes
- Check for periosteal reactions
Provide a detailed bone-focused report.""",

    "soft_tissue": """Focus on soft tissue structures in this image. Analyze:
- Soft tissue swelling, masses, or asymmetry
- Fat planes and fascial planes
- Calcifications within soft tissues
- Air in soft tissues (surgical emphysema)
- Vascular structures visibility
- Lymph nodes if visible
Provide a detailed soft tissue analysis.""",

    "pathology": """Act as a diagnostic pathology-focused radiologist. Specifically hunt for:
- Any masses, nodules, or lesions (size, location, characteristics)
- Signs of infection or inflammation
- Vascular abnormalities
- Pleural/pericardial effusions
- Consolidations or infiltrates
- Atelectasis or collapse
- Pneumothorax or pneumomediastinum
- Any subtle findings that could be clinically significant
Be extremely thorough in pathology detection.""",

    "cardiac": """Focus on cardiovascular structures. Analyze:
- Heart size and cardiothoracic ratio
- Cardiac silhouette shape and contours
- Aortic knuckle and descending aorta
- Pulmonary vascularity (normal/increased/decreased)
- Signs of pulmonary edema or venous hypertension
- Mediastinal width
- Any cardiac devices or prostheses
Provide detailed cardiopulmonary assessment.""",

    "compare": """Provide a detailed comparison analysis framework:
- Identify the anatomical region and likely clinical context
- List all normal variant considerations
- Provide expected vs. observed findings
- Age-related normal changes vs pathological findings
- Common pitfalls and mimics in this type of image
- What additional views or modalities would complement this study"""
}


# ---------------------------------------------------------------------------
# Provider availability checks
# ---------------------------------------------------------------------------
def _gemini_available():
    """Check if Gemini API is configured and reachable."""
    if not GEMINI_API_KEY:
        return False
    try:
        url = f"{GEMINI_BASE}/models/{GEMINI_MODEL}?key={GEMINI_API_KEY}"
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=8) as resp:
            return resp.status == 200
    except Exception:
        return False


def _ollama_available():
    """Check if Ollama is running and the configured model exists."""
    try:
        req = urllib.request.Request(f"{OLLAMA_BASE}/api/tags")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            models = [m["name"] for m in data.get("models", [])]
            return OLLAMA_MODEL in models
    except Exception:
        return False


def _active_provider():
    """Return 'gemini' if available, else 'ollama' if available, else None."""
    if GEMINI_API_KEY and _gemini_available():
        return "gemini"
    if _ollama_available():
        return "ollama"
    return None


# ---------------------------------------------------------------------------
# Gemini helpers
# ---------------------------------------------------------------------------
def _gemini_build_payload(system_text, user_text, image_b64=None, mime_type="image/jpeg", max_tokens=4096):
    """Build a Gemini generateContent request payload."""
    user_parts = []
    if image_b64:
        user_parts.append({
            "inline_data": {
                "mime_type": mime_type,
                "data": image_b64,
            }
        })
    user_parts.append({"text": user_text})

    payload = {
        "contents": [{"role": "user", "parts": user_parts}],
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": 0.2,
        },
    }
    if system_text:
        payload["systemInstruction"] = {"parts": [{"text": system_text}]}
    return payload


def _gemini_chat_stream(system_text, user_text, image_b64=None, mime_type="image/jpeg", max_tokens=4096):
    """Stream chat completions from Gemini. Yields text chunks."""
    payload = _gemini_build_payload(system_text, user_text, image_b64, mime_type, max_tokens)
    data = json.dumps(payload).encode("utf-8")
    url = f"{GEMINI_BASE}/models/{GEMINI_MODEL}:streamGenerateContent?alt=sse&key={GEMINI_API_KEY}"

    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")

    with urllib.request.urlopen(req, timeout=300) as resp:
        for raw_line in resp:
            line = raw_line.decode("utf-8").strip()
            if not line.startswith("data: "):
                continue
            try:
                chunk = json.loads(line[6:])
            except json.JSONDecodeError:
                continue
            for candidate in chunk.get("candidates", []):
                for part in candidate.get("content", {}).get("parts", []):
                    text = part.get("text", "")
                    if text:
                        yield text


def _gemini_chat_sync(system_text, user_text, image_b64=None, mime_type="image/jpeg", max_tokens=1500):
    """Non-streaming chat completion from Gemini. Returns full text."""
    payload = _gemini_build_payload(system_text, user_text, image_b64, mime_type, max_tokens)
    data = json.dumps(payload).encode("utf-8")
    url = f"{GEMINI_BASE}/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"

    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")

    with urllib.request.urlopen(req, timeout=300) as resp:
        result = json.loads(resp.read())

    text = ""
    for candidate in result.get("candidates", []):
        for part in candidate.get("content", {}).get("parts", []):
            text += part.get("text", "")
    return text


# ---------------------------------------------------------------------------
# Ollama helpers
# ---------------------------------------------------------------------------
def _ollama_chat_stream(system_text, user_text, image_b64=None, mime_type="image/jpeg", max_tokens=4096):
    """Stream chat completions from Ollama. Yields text chunks."""
    messages = []
    if system_text:
        messages.append({"role": "system", "content": system_text})
    user_msg = {"role": "user", "content": user_text}
    if image_b64:
        user_msg["images"] = [image_b64]
    messages.append(user_msg)

    payload = json.dumps({
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": True,
        "options": {"num_predict": max_tokens, "temperature": 0.0},
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{OLLAMA_BASE}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=300) as resp:
        for line in resp:
            if not line.strip():
                continue
            chunk = json.loads(line)
            text = chunk.get("message", {}).get("content", "")
            if text:
                yield text
            if chunk.get("done", False):
                break


def _ollama_chat_sync(system_text, user_text, image_b64=None, mime_type="image/jpeg", max_tokens=1500):
    """Non-streaming chat completion from Ollama. Returns full text."""
    messages = []
    if system_text:
        messages.append({"role": "system", "content": system_text})
    user_msg = {"role": "user", "content": user_text}
    if image_b64:
        user_msg["images"] = [image_b64]
    messages.append(user_msg)

    payload = json.dumps({
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "options": {"num_predict": max_tokens, "temperature": 0.0},
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{OLLAMA_BASE}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=300) as resp:
        result = json.loads(resp.read())
    return result.get("message", {}).get("content", "")


# ---------------------------------------------------------------------------
# Unified provider dispatch
# ---------------------------------------------------------------------------
def _resolve_provider():
    """Return the provider name to use for this request."""
    if GEMINI_API_KEY:
        return "gemini"
    return "ollama"


def chat_stream(system_text, user_text, image_b64=None, mime_type="image/jpeg", max_tokens=4096):
    """Stream text from the best available provider. Tries Gemini, falls back to Ollama."""
    provider = _resolve_provider()
    if provider == "gemini":
        try:
            yielded = False
            for chunk in _gemini_chat_stream(system_text, user_text, image_b64, mime_type, max_tokens):
                yielded = True
                yield chunk
            if yielded:
                return
        except Exception:
            pass
        # Gemini failed — fall through to Ollama
    yield from _ollama_chat_stream(system_text, user_text, image_b64, mime_type, max_tokens)


def chat_sync(system_text, user_text, image_b64=None, mime_type="image/jpeg", max_tokens=1500):
    """Sync text from the best available provider. Tries Gemini, falls back to Ollama."""
    provider = _resolve_provider()
    if provider == "gemini":
        try:
            result = _gemini_chat_sync(system_text, user_text, image_b64, mime_type, max_tokens)
            if result.strip():
                return result
        except Exception:
            pass
    return _ollama_chat_sync(system_text, user_text, image_b64, mime_type, max_tokens)


# ---------------------------------------------------------------------------
# SSE helper
# ---------------------------------------------------------------------------
def _sse_response(generator):
    """Wrap an SSE generator in a Flask streaming Response."""
    return Response(
        stream_with_context(generator),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive',
        }
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route('/api/health', methods=['GET'])
def health():
    gemini_ok = _gemini_available() if GEMINI_API_KEY else False
    ollama_ok = _ollama_available()

    if gemini_ok:
        status = "healthy"
        active = "gemini"
        model = GEMINI_MODEL
    elif ollama_ok:
        status = "healthy"
        active = "ollama"
        model = OLLAMA_MODEL
    else:
        status = "degraded"
        active = None
        model = None

    return jsonify({
        "status": status,
        "provider": active,
        "model": model,
        "gemini_available": gemini_ok,
        "ollama_available": ollama_ok,
    })


@app.route('/api/upload', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp', 'dcm'}
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in allowed_extensions:
        return jsonify({"error": f"File type .{ext} not supported"}), 400

    img_bytes = file.read()

    try:
        img = Image.open(io.BytesIO(img_bytes))
        width, height = img.size
        img_format = img.format or 'JPEG'
        mode = img.mode
    except Exception as e:
        return jsonify({"error": f"Could not process image: {str(e)}"}), 400

    img_b64 = base64.b64encode(img_bytes).decode('utf-8')
    mime_type = f"image/{img_format.lower()}" if img_format.lower() != 'jpg' else 'image/jpeg'

    return jsonify({
        "success": True,
        "image_data": img_b64,
        "mime_type": mime_type,
        "metadata": {
            "filename": file.filename,
            "width": width,
            "height": height,
            "format": img_format,
            "mode": mode,
            "size_bytes": len(img_bytes)
        }
    })


@app.route('/api/analyze', methods=['POST'])
def analyze_image():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    image_data = data.get('image_data')
    mime_type = data.get('mime_type', 'image/jpeg')

    if not image_data:
        return jsonify({"error": "No image data provided"}), 400

    user_prompt = (
        "Please provide a comprehensive radiological analysis of this "
        "medical image. Be thorough and systematic in your assessment."
    )

    def generate():
        try:
            for text in chat_stream(SYSTEM_PROMPT, user_prompt, image_data, mime_type, max_tokens=4096):
                yield f"data: {json.dumps({'text': text, 'done': False})}\n\n"
            yield f"data: {json.dumps({'text': '', 'done': True})}\n\n"
        except urllib.error.URLError as e:
            yield f"data: {json.dumps({'error': f'Cannot reach AI provider. Error: {e.reason}', 'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"

    return _sse_response(generate())


@app.route('/api/analyze/tool', methods=['POST'])
def analyze_with_tool():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    image_data = data.get('image_data')
    mime_type = data.get('mime_type', 'image/jpeg')
    tool = data.get('tool', 'bone')

    if not image_data:
        return jsonify({"error": "No image data provided"}), 400

    tool_prompt = TOOL_PROMPTS.get(tool, TOOL_PROMPTS['bone'])

    def generate():
        try:
            for text in chat_stream(SYSTEM_PROMPT, tool_prompt, image_data, mime_type, max_tokens=3000):
                yield f"data: {json.dumps({'text': text, 'done': False})}\n\n"
            yield f"data: {json.dumps({'text': '', 'done': True})}\n\n"
        except urllib.error.URLError as e:
            yield f"data: {json.dumps({'error': f'Cannot reach AI provider. Error: {e.reason}', 'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"

    return _sse_response(generate())


@app.route('/api/analyze/annotate', methods=['POST'])
def annotate_image():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    image_data = data.get('image_data')
    mime_type = data.get('mime_type', 'image/jpeg')

    if not image_data:
        return jsonify({"error": "No image data provided"}), 400

    try:
        provider = _resolve_provider()

        if provider == "gemini":
            findings = _annotate_with_gemini(image_data, mime_type)
        else:
            findings = _annotate_with_ollama(image_data, mime_type)

        return jsonify({"annotations": findings})

    except json.JSONDecodeError as e:
        return jsonify({"error": f"Could not parse model response as JSON: {str(e)}", "annotations": []}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _annotate_with_gemini(image_data, mime_type):
    """Use Gemini vision to detect pathologies with bounding boxes and disease names."""
    describe_prompt = """Analyze this medical image as an expert radiologist. Identify ALL abnormal or pathological findings.

For each finding, return:
- "label": the specific medical condition / disease name (e.g., "Pneumothorax", "Cardiomegaly", "Pleural Effusion", "Pulmonary Nodule", "Atelectasis", "Fracture")
- "box_2d": [y_min, x_min, y_max, x_max] as coordinates normalized to a 0–1000 scale, where (0,0) is top-left and (1000,1000) is bottom-right of the image. Make the bounding box tightly fit the abnormality.

Return ONLY a valid JSON array with no markdown, no code fences, and no explanation.
Example: [{"label": "Right Pneumothorax", "box_2d": [80, 520, 450, 920]}, {"label": "Pleural Effusion", "box_2d": [600, 50, 900, 480]}]
If no abnormalities are found, return: []"""

    raw = ""
    try:
        raw = _gemini_chat_sync(None, describe_prompt, image_data, mime_type, max_tokens=1500)
    except Exception:
        # Gemini failed, try Ollama fallback
        return _annotate_with_ollama(image_data, mime_type)

    return _parse_annotation_response(raw, use_region_map=False)


def _annotate_with_ollama(image_data, mime_type):
    """Use Ollama to detect pathologies. Falls back to region-mapping for boxes."""
    describe_prompt = """Look at this medical image carefully. List any abnormal or pathological findings you can see.

For each finding, describe:
1. The specific disease or condition name (e.g., "Pneumothorax", "Cardiomegaly", "Pleural Effusion")
2. Where it is located using these terms: "left" or "right" (of the image), "upper", "middle", or "lower" (vertical position), and optionally "center" if it is in the middle horizontally.

Return ONLY a JSON array. No markdown, no code blocks, no explanation.
Example format:
[{"label": "Pneumothorax", "position": "right upper"}, {"label": "Pleural Effusion", "position": "left lower"}]

If no abnormalities found, return: []"""

    raw = _ollama_chat_sync(None, describe_prompt, image_data, mime_type, max_tokens=1500)
    return _parse_annotation_response(raw, use_region_map=True)


def _parse_annotation_response(raw, use_region_map=False):
    """Parse a model response into a list of annotation dicts."""
    cleaned = raw.strip()

    # Strip markdown code fences
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()

    # Extract JSON array
    if "[" in cleaned:
        json_start = cleaned.index("[")
        json_end = cleaned.rindex("]") + 1
        cleaned = cleaned[json_start:json_end]

    findings = json.loads(cleaned)

    results = []
    for finding in findings:
        if not isinstance(finding, dict):
            continue

        label = str(finding.get("label", "Finding"))[:50]

        if not use_region_map and "box_2d" in finding:
            # Gemini returned direct bounding box coordinates
            box = finding["box_2d"]
            if isinstance(box, list) and len(box) == 4:
                box = [_clamp(int(v), 0, 1000) for v in box]
            else:
                box = [250, 250, 750, 750]
        else:
            # Ollama: map position description to bounding box
            position = str(finding.get("position", "center middle"))
            box = _position_to_box(position)

        results.append({
            "label": label,
            "box_2d": box,
            "type": "pathology",
        })

    return results


def _clamp(value, lo, hi):
    return max(lo, min(hi, value))


# Region map for Ollama text-based position → bounding box conversion
REGION_MAP = {
    "left":    (50, 450),
    "right":   (550, 950),
    "center":  (300, 700),
    "upper":   (50, 380),
    "middle":  (300, 650),
    "lower":   (550, 900),
    "top":     (50, 380),
    "bottom":  (550, 900),
    "mid":     (300, 650),
    "central": (300, 700),
}


def _position_to_box(position_str):
    """Convert a position description like 'right lower' to [y_min, x_min, y_max, x_max]."""
    tokens = position_str.lower().replace("-", " ").replace(",", " ").split()

    x_min, x_max = 250, 750
    y_min, y_max = 250, 750

    for token in tokens:
        if token in ("left", "right", "center", "central"):
            x_min, x_max = REGION_MAP[token]
        elif token in ("upper", "top", "middle", "mid", "lower", "bottom"):
            y_min, y_max = REGION_MAP[token]

    return [y_min, x_min, y_max, x_max]


if __name__ == '__main__':
    app.run(debug=True, port=5000, threaded=True)
