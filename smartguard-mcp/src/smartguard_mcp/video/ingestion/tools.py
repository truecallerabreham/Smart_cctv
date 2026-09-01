import base64
import os
import shutil
import subprocess
from io import BytesIO
from pathlib import Path
from uuid import uuid4

import av
import loguru
from PIL import Image

logger = loguru.logger.bind(name="VideoTools")


def _resolve_ffmpeg() -> str:
    """Locate the ffmpeg binary.

    Tries PATH first, then a couple of known Windows install locations. The MCP
    server runs as a background process that may not inherit a freshly-added
    user PATH, so this fallback matters.
    """
    found = shutil.which("ffmpeg")
    if found:
        return found
    for candidate in (
        r"C:\Users\HP\Documents\ffmpeg.exe",
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
    ):
        if Path(candidate).exists():
            return candidate
    return "ffmpeg"


FFMPEG_BIN = _resolve_ffmpeg()


def extract_video_clip(video_path: str, start_time: float, end_time: float, output_path: str = None) -> str:
    """Extract a video clip using ffmpeg and return the output path.

    Uses ffmpeg subprocess for reliability (MoviePy crashes on long videos).
    """
    if start_time >= end_time:
        raise ValueError("start_time must be less than end_time")

    # Convert relative output path to absolute path in the API's shared_media directory
    # so the frontend can serve it via the /media endpoint
    if output_path is None or output_path.startswith("./"):
        from pathlib import Path
        api_shared_media = Path(r"C:\Users\HP\Documents\smartcctv\smartguard-api\shared_media")
        api_shared_media.mkdir(parents=True, exist_ok=True)
        filename = Path(output_path).name if output_path else f"{uuid4()}.mp4"
        output_path = str(api_shared_media / filename)

    ## Anatomy of FFMPEG command
    # -i = input file
    # -ss/-to = start and end time of the clip, formatted as seconds or hh:mm:ss
    # -c (:v, :a) = sets the codec for the audio, and video channels
    # -preset = encoding speed/quality split
    # last argument is the output video path (if using libx264, it must end with .mp4)
    command = [
        FFMPEG_BIN,
        "-ss",
        str(start_time),
        "-to",
        str(end_time),
        "-i",
        video_path,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "23",
        "-c:a",
        "copy",
        "-y",
        output_path,
    ]

    try:
        process = subprocess.run(command, capture_output=True, text=True, timeout=120)
        logger.debug(f"FFmpeg stdout: {process.stdout[:500] if process.stdout else ''}")
        logger.debug(f"FFmpeg stderr: {process.stderr[:500] if process.stderr else ''}")

        if process.returncode != 0:
            raise IOError(f"FFmpeg failed with code {process.returncode}: {process.stderr[:200] if process.stderr else 'unknown error'}")

        # Verify the output file was actually created
        from pathlib import Path as PathLib
        if not PathLib(output_path).exists():
            raise IOError(f"FFmpeg completed but output file not found at {output_path}")

        return output_path
    except subprocess.TimeoutExpired:
        raise IOError("FFmpeg extraction timed out after 120 seconds")
    except Exception as e:
        logger.error(f"Video clip extraction failed: {e}")
        raise IOError(f"Failed to extract video clip: {str(e)}")


def encode_image(image: str | Image.Image) -> str:
    """Encode an image to base64 string.

    Args:
        image (Union[str, Image.Image]): Either a file path to an image or a PIL Image object

    Returns:
        str: Base64 encoded string representation of the image

    Raises:
        FileNotFoundError: If the image path does not exist
        IOError: If there are issues reading or processing the image
    """
    try:
        if isinstance(image, str):
            with open(image, "rb") as image_file:
                image_str = image_file.read()
        else:
            if not image.format:
                image_format = "JPEG"
            else:
                image_format = image.format

            buffered = BytesIO()
            image.save(buffered, format=image_format)
            image_str = buffered.getvalue()

        return base64.b64encode(image_str).decode("utf-8")

    except (FileNotFoundError, IOError) as e:
        raise IOError(f"Failed to process image: {str(e)}")


def decode_image(base64_string: str) -> Image.Image:
    """Decode a base64 string back into a PIL Image object.

    Args:
        base64_string (str): Base64 encoded string representation of an image

    Returns:
        Image.Image: PIL Image object

    Raises:
        ValueError: If the base64 string is invalid
        IOError: If there are issues processing the image data
    """
    try:
        image_bytes = base64.b64decode(base64_string)
        image_buffer = BytesIO(image_bytes)

        return Image.open(image_buffer)

    except (ValueError, IOError) as e:
        raise IOError(f"Failed to decode image: {str(e)}")


def re_encode_video(video_path: str) -> str:
    """
    Re-encode a video file to ensure compatibility with PyAV.

    Note: In case a video was downloaded from the web, it may not be compatible with PyAV.
    This function attempts to re-encode the video using FFmpeg and returns the path to the re-encoded video.
    """
    if not Path(video_path).exists():
        logger.error(f"Error: Video file not found at {video_path}")
        return False

    try:
        with av.open(video_path) as _:
            logger.info(f"Video {video_path} successfully opened by PyAV.")
            return str(video_path)
    except Exception as e:
        logger.error(f"An unexpected error occurred while trying to open video {video_path}: {e}")

    o_dir, o_fname = Path(video_path).parent, Path(video_path).name
    reencoded_filename = f"re_{o_fname}"
    reencoded_video_path = Path(o_dir) / reencoded_filename

    command = [FFMPEG_BIN, "-i", video_path, "-c", "copy", str(reencoded_video_path)]

    logger.info(f"Attempting to re-encode video using FFmpeg: {' '.join(command)}")

    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        logger.info(f"FFmpeg re-encoding successful for {video_path} to {reencoded_video_path}")
        logger.debug(f"FFmpeg stdout: {result.stdout}")
        logger.debug(f"FFmpeg stderr: {result.stderr}")

        try:
            with av.open(reencoded_video_path) as _:
                logger.info(f"Re-encoded video {reencoded_video_path} successfully opened by PyAV.")
                return str(reencoded_video_path)
        except Exception as e:
            logger.error(
                f"An unexpected error occurred while trying to open re-encoded video {reencoded_video_path}: {e}"
            )
            return None
    except Exception as e:
        logger.error(f"An unexpected error occurred during FFmpeg re-encoding: {e}")
        return None
