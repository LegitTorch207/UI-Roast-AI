import os
import base64
import json
import re
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

# ── Config ──────────────────────────────────────────
UPLOAD_FOLDER      = "uploads"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "") # <-- paste your key here

app = Flask(__name__)
CORS(app, origins="*")
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# ── Helpers ──────────────────────────────────────────
def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def get_mime_type(filename):
    ext = filename.rsplit(".", 1)[1].lower()
    mapping = {
        "jpg":  "image/jpeg",
        "jpeg": "image/jpeg",
        "png":  "image/png",
        "gif":  "image/gif",
        "webp": "image/webp",
    }
    return mapping.get(ext, "image/jpeg")

def encode_image(filepath):
    with open(filepath, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

def parse_ai_response(text):
    clean = re.sub(r"```json\s*", "", text)
    clean = re.sub(r"```\s*", "", clean)
    clean = clean.strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", clean, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise

@app.route("/", methods=["GET"])
def home():
    return jsonify({"status": "UI Roast AI backend is running!"})

# ── Route ────────────────────────────────────────────
@app.route("/analyze", methods=["POST"])
def analyze():
    if "image" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["image"]

    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type. Use PNG, JPG, GIF, or WEBP."}), 400

    # Save file
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)
    print(f"[+] Saved: {filepath}")

    # Encode image
    image_data = encode_image(filepath)
    mime_type  = get_mime_type(filename)

    prompt = """You are an expert UI/UX designer and accessibility consultant.
Analyze the provided UI screenshot and return ONLY a valid JSON object — no markdown, no explanation, just raw JSON.

The JSON must follow this exact structure:
{
  "design_score": <integer 0-100>,
  "accessibility_score": <integer 0-100>,
  "mobile_score": <integer 0-100>,
  "ui_issues": [<up to 5 specific UI/UX problems as strings>],
  "color_suggestions": [<up to 4 color improvement suggestions as strings>],
  "mobile_tips": [<up to 4 mobile responsiveness tips as strings>],
  "cta_fixes": [<up to 4 call-to-action improvement suggestions as strings>]
}

Scoring guide:
- design_score: visual hierarchy, spacing, typography, consistency
- accessibility_score: contrast ratios, font sizes, labels, ARIA considerations
- mobile_score: responsiveness, touch targets, layout adaptability

Be specific and actionable. Reference actual elements visible in the screenshot."""

    try:
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "openrouter/auto",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{image_data}"
                                }
                            },
                            {
                                "type": "text",
                                "text": prompt
                            }
                        ]
                    }
                ]
            }
        )

        result = response.json()
        print(f"[+] OpenRouter response: {result}")

        if "error" in result:
            return jsonify({"error": result["error"].get("message", "Unknown error")}), 500

        raw_text = result["choices"][0]["message"]["content"]
        print(f"[+] AI text:\n{raw_text}\n")

        data = parse_ai_response(raw_text)
        return jsonify(data)

    except json.JSONDecodeError as e:
        print(f"[!] JSON parse error: {e}")
        return jsonify({"error": "AI returned invalid JSON. Try again."}), 500

    except Exception as e:
        print(f"[!] Error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=7860)
