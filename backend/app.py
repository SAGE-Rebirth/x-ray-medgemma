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
# Ollama config
# ---------------------------------------------------------------------------
OLLAMA_BASE = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "amsaravi/medgemma-4b-it:q6")

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------
app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"])


SYSTEM_PROMPT = """You are Dr. MedGemma, a board-certified radiologist and cardiothoracic surgeon with 20 years of experience interpreting medical imaging. You have subspecialty expertise in chest radiology, musculoskeletal imaging, neuroradiology, and abdominal imaging. You have published over 200 peer-reviewed papers and trained hundreds of radiology residents.

When analyzing medical images, provide a comprehensive report with these sections:

## 🔬 Technical Quality Assessment
Evaluate image quality, positioning, exposure technique, any artifacts or limitations.

## 📋 Systematic Findings
A methodical, organ-by-organ review of ALL visible structures. Be thorough and systematic.

## ⚠️ Abnormal Findings
Detailed description of any pathology: location, size, density/attenuation, margins, shape, associated findings.

## 🎯 Clinical Impression
Your primary diagnosis with confidence level (High/Moderate/Low confidence).

## 🔄 Differential Diagnoses
Ranked list with brief reasoning for each.

## 📌 Recommendations
Next steps: additional imaging, laboratory workup, clinical correlation, follow-up interval.

## 🚨 Urgency Level
**[STAT / URGENT / ROUTINE / INCIDENTAL]** with brief justification.

Use proper radiological terminology. Be thorough, precise, and clinically relevant.

⚕️ **DISCLAIMER**: This AI analysis is for educational purposes only and must be correlated with clinical findings by a licensed physician. Not for diagnostic use."""

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
# Ollama streaming helper
# ---------------------------------------------------------------------------
def _ollama_chat_stream(messages, max_tokens=4096):
    """Stream chat completions from Ollama. Yields text chunks."""
    payload = json.dumps({
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": True,
        "options": {
            "num_predict": max_tokens,
            "temperature": 0.0,
        },
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


def _ollama_chat_sync(messages, max_tokens=1500):
    """Non-streaming chat completion from Ollama. Returns full text."""
    payload = json.dumps({
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "options": {
            "num_predict": max_tokens,
            "temperature": 0.0,
        },
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
    # Quick check: is Ollama reachable?
    ollama_ok = False
    try:
        req = urllib.request.Request(f"{OLLAMA_BASE}/api/tags")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            models = [m["name"] for m in data.get("models", [])]
            ollama_ok = OLLAMA_MODEL in models
    except Exception:
        pass

    return jsonify({
        "status": "healthy" if ollama_ok else "degraded",
        "model": OLLAMA_MODEL,
        "backend": "ollama",
        "ollama_reachable": ollama_ok,
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

    if not image_data:
        return jsonify({"error": "No image data provided"}), 400

    user_prompt = (
        "Please provide a comprehensive radiological analysis of this "
        "medical image. Be thorough and systematic in your assessment."
    )

    def generate():
        try:
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt, "images": [image_data]},
            ]

            for text in _ollama_chat_stream(messages, max_tokens=4096):
                yield f"data: {json.dumps({'text': text, 'done': False})}\n\n"

            yield f"data: {json.dumps({'text': '', 'done': True})}\n\n"

        except urllib.error.URLError as e:
            yield f"data: {json.dumps({'error': f'Cannot reach Ollama at {OLLAMA_BASE}. Is it running? Error: {e.reason}', 'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"

    return _sse_response(generate())


@app.route('/api/analyze/tool', methods=['POST'])
def analyze_with_tool():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    image_data = data.get('image_data')
    tool = data.get('tool', 'bone')

    if not image_data:
        return jsonify({"error": "No image data provided"}), 400

    tool_prompt = TOOL_PROMPTS.get(tool, TOOL_PROMPTS['bone'])

    def generate():
        try:
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": tool_prompt, "images": [image_data]},
            ]

            for text in _ollama_chat_stream(messages, max_tokens=3000):
                yield f"data: {json.dumps({'text': text, 'done': False})}\n\n"

            yield f"data: {json.dumps({'text': '', 'done': True})}\n\n"

        except urllib.error.URLError as e:
            yield f"data: {json.dumps({'error': f'Cannot reach Ollama at {OLLAMA_BASE}. Is it running? Error: {e.reason}', 'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"

    return _sse_response(generate())


@app.route('/api/analyze/annotate', methods=['POST'])
def annotate_image():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    image_data = data.get('image_data')

    if not image_data:
        return jsonify({"error": "No image data provided"}), 400

    try:
        # Step 1: Ask model to describe findings with spatial location
        describe_prompt = """Look at this medical image carefully. List any abnormal or pathological findings you can see.

For each finding, describe:
1. What the abnormality is (2-5 words)
2. Where it is located using these terms: "left" or "right" (of the image), "upper", "middle", or "lower" (vertical position), and optionally "center" if it is in the middle horizontally.

Return ONLY a JSON array. No markdown, no code blocks, no explanation.
Example format:
[{"label": "Lung opacity", "position": "right lower"}, {"label": "Pleural effusion", "position": "left lower"}]

If no abnormalities found, return: []"""

        messages = [
            {"role": "user", "content": describe_prompt, "images": [image_data]},
        ]

        raw = _ollama_chat_sync(messages, max_tokens=1500)

        # Strip markdown code fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()

        # Try to extract JSON array from the response
        if "[" in cleaned:
            json_start = cleaned.index("[")
            json_end = cleaned.rindex("]") + 1
            cleaned = cleaned[json_start:json_end]

        findings = json.loads(cleaned)

        # Step 2: Map spatial descriptions to bounding box coordinates
        # Coordinates are in 0-1000 normalized space, format: [y_min, x_min, y_max, x_max]
        REGION_MAP = {
            # Horizontal
            "left":   (50, 450),     # x range
            "right":  (550, 950),
            "center": (300, 700),
            # Vertical
            "upper":  (50, 380),     # y range
            "middle": (300, 650),
            "lower":  (550, 900),
            # Aliases
            "top":    (50, 380),
            "bottom": (550, 900),
            "mid":    (300, 650),
            "central":(300, 700),
        }

        BOX_SIZE = 220  # default box size if only one axis is described

        def position_to_box(position_str):
            """Convert a position description like 'right lower' to [y_min, x_min, y_max, x_max]."""
            pos = position_str.lower().strip()
            tokens = pos.replace("-", " ").replace(",", " ").split()

            x_min, x_max = 250, 750  # default: center-ish
            y_min, y_max = 250, 750

            for token in tokens:
                if token in ("left", "right", "center", "central"):
                    x_min, x_max = REGION_MAP[token]
                elif token in ("upper", "top", "middle", "mid", "lower", "bottom"):
                    y_min, y_max = REGION_MAP[token]

            return [y_min, x_min, y_max, x_max]

        clean = []
        for finding in findings:
            if not isinstance(finding, dict):
                continue
            label = str(finding.get("label", "Finding"))[:40]
            position = str(finding.get("position", "center middle"))
            box = position_to_box(position)
            clean.append({
                "label": label,
                "box_2d": box,
                "type": "pathology",
            })

        return jsonify({"annotations": clean})

    except json.JSONDecodeError as e:
        return jsonify({"error": f"Could not parse model response as JSON: {str(e)}", "annotations": []}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000, threaded=True)
