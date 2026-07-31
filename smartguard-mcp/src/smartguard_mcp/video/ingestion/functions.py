import base64

import httpx
import pixeltable as pxt
from loguru import logger
from PIL import Image

from smartguard_mcp.config import get_settings

settings = get_settings()


@pxt.udf
def extract_text_from_chunk(transcript: pxt.type_system.Json) -> str:
    """
    Extract text from a transcript JSON object.
    Note: Predictions of common S2T models are in dict format containing the text and chunk timestamps metadata. We need the text only.
    """
    return f"{transcript['text']}"


@pxt.udf
def resize_image(image: pxt.type_system.Image, width: int, height: int) -> pxt.type_system.Image:
    """
    Resize an image to fit within the specified width and height while maintaining aspect ratio.
    Note: The PIL.Image.thumbnail() method modifies the image in place.
    """
    if not isinstance(image, Image.Image):
        raise TypeError("Input must be a PIL Image")

    image.thumbnail((width, height))
    return image


@pxt.udf
def gemini_transcribe(audio_path: pxt.Audio) -> pxt.type_system.Json:
    """Transcribe an audio chunk using Google Gemini's native audio API.

    Gemini's OpenAI-compatible endpoint does not expose a ``/audio/transcriptions``
    route (Whisper-style), so we call the native ``generateContent`` endpoint with
    the audio payload inlined as base64. The return shape mirrors the dict
    produced by ``openai.transcriptions()`` so downstream UDFs
    (``extract_text_from_chunk``) work unchanged.
    """
    try:
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
    except Exception as e:
        logger.error(f"Failed to read audio chunk {audio_path}: {e}")
        return {"text": ""}

    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

    ext = str(audio_path).rsplit(".", 1)[-1].lower()
    mime_map = {
        "mp3": "audio/mpeg",
        "wav": "audio/wav",
        "m4a": "audio/mp4",
        "ogg": "audio/ogg",
        "flac": "audio/flac",
    }
    mime_type = mime_map.get(ext, "audio/mpeg")

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.AUDIO_TRANSCRIPT_MODEL}:generateContent?key={settings.OPENAI_API_KEY}"
    )
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": (
                            "Transcribe this audio clip exactly. "
                            "Return only the transcribed speech text, nothing else. "
                            "If the audio is silent or contains no speech, return an empty string."
                        )
                    },
                    {"inline_data": {"mime_type": mime_type, "data": audio_b64}},
                ]
            }
        ],
        "generationConfig": {"temperature": 0.0},
    }

    try:
        resp = httpx.post(url, json=payload, timeout=120.0)
        resp.raise_for_status()
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        return {"text": text}
    except Exception as e:
        logger.error(f"Gemini transcription failed for {audio_path}: {e}")
        return {"text": ""}
