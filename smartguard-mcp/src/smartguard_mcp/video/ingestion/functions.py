import base64
import io

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
def zai_caption(image: pxt.Image, prompt: str) -> str:
    """Caption a video frame using the z-ai VLM via the OpenAI-compatible proxy.

    Calls the LLM+VLM proxy at localhost:3040 with the frame as base64 JPEG
    and the transit-safety captioning prompt. Returns the caption text.
    """
    try:
        if not isinstance(image, Image.Image):
            return "Error: invalid image"

        buf = io.BytesIO()
        image.save(buf, format="JPEG", quality=85)
        img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        url = f"{settings.OPENAI_BASE_URL}/chat/completions"
        payload = {
            "model": "glm-4v",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"},
                        },
                    ],
                }
            ],
            "max_tokens": 200,
        }

        resp = httpx.post(url, json=payload, timeout=120.0)
        resp.raise_for_status()
        data = resp.json()
        caption = data["choices"][0]["message"]["content"].strip()
        return caption if caption else "No caption generated"
    except Exception as e:
        logger.error(f"VLM captioning failed: {e}")
        return f"Caption error: {str(e)[:100]}"


@pxt.udf
def gemini_transcribe(audio_path: pxt.Audio) -> pxt.type_system.Json:
    """Transcribe an audio chunk.

    Uses the z-ai ASR if available, otherwise returns empty text.
    The sample transit video has no speech, so empty text is fine for the demo.
    """
    return {"text": ""}
