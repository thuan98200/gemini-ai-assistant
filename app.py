
import os
import base64
import binascii
import io

from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from PIL import Image, UnidentifiedImageError
from google import genai
from google.genai import types

load_dotenv()

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024

API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

client = genai.Client(api_key=API_KEY) if API_KEY else None


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json(silent=True) or {}
        prompt = str(data.get("prompt", "")).strip()

        if not prompt:
            return jsonify(error="Vui long nhap cau hoi."), 400

        if len(prompt) > 10000:
            return jsonify(error="Cau hoi qua dai."), 400

        temperature = float(data.get("temperature", 0.7))
        top_p = float(data.get("top_p", 0.9))

        if not 0 <= temperature <= 2:
            return jsonify(error="Temperature phai tu 0 den 2."), 400

        if not 0 < top_p <= 1:
            return jsonify(error="Top-P phai lon hon 0 va toi da 1."), 400

        if client is None:
            return jsonify(
                error="Chua cau hinh GEMINI_API_KEY tren Render."
            ), 500

        contents = [prompt]
        image_data = data.get("image")

        if image_data:
            if not isinstance(image_data, str) or "," not in image_data:
                return jsonify(error="Du lieu anh khong hop le."), 400

            header, encoded = image_data.split(",", 1)
            allowed = {
                "data:image/png;base64",
                "data:image/jpeg;base64",
                "data:image/webp;base64",
            }

            if header not in allowed:
                return jsonify(
                    error="Chi chap nhan anh PNG, JPEG hoac WebP."
                ), 400

            try:
                raw = base64.b64decode(encoded, validate=True)

                if len(raw) > 5 * 1024 * 1024:
                    return jsonify(error="Anh toi da 5 MB."), 400

                with Image.open(io.BytesIO(raw)) as img:
                    img.verify()

                with Image.open(io.BytesIO(raw)) as img:
                    formats = {
                        "PNG": "image/png",
                        "JPEG": "image/jpeg",
                        "WEBP": "image/webp",
                    }
                    mime = formats.get(img.format)

                if mime != header.replace("data:", "").replace(";base64", ""):
                    return jsonify(error="Dinh dang anh khong khop."), 400

                contents.append(
                    types.Part.from_bytes(data=raw, mime_type=mime)
                )

            except (binascii.Error, ValueError, OSError,
                    UnidentifiedImageError):
                return jsonify(error="Khong doc duoc anh."), 400

        response = client.models.generate_content(
            model=MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=temperature,
                top_p=top_p,
                max_output_tokens=2048,
            ),
        )

        if not response.text:
            return jsonify(error="Gemini khong tra ve cau tra loi."), 502

        return jsonify(answer=response.text)

    except Exception:
        app.logger.exception("Gemini request failed")
        return jsonify(
            error="Khong the goi Gemini. Hay kiem tra API Key, model "
                  "va cau hinh mang."
        ), 500


@app.errorhandler(413)
def too_large(error):
    return jsonify(error="Du lieu gui len qua lon."), 413


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
