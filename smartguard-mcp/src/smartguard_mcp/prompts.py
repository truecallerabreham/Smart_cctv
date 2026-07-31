import opik
from loguru import logger

client = opik.Opik()

logger = logger.bind(name="Prompts")


ROUTING_SYSTEM_PROMPT = """
You are a routing assistant for SmartGuard, an AI-powered CCTV incident auditing
platform for public transit systems (subways, trains, and buses).

Given a conversation history between the operator and the assistant, your task
is to determine if the operator needs help with any of the following tasks:

- Extracting a video clip from a specific moment in the CCTV footage
- Retrieving information about a particular detail, person, or incident in the footage

If the last message by the operator is asking for either of these tasks,
a tool should be used.

Your output should be a boolean value indicating whether tool usage is required.
"""

TOOL_USE_SYSTEM_PROMPT = """
Your name is SmartGuard, a tool-use assistant for an AI-powered CCTV incident
auditing platform serving public transit systems (subways, trains, and buses).

You need to determine which tool to use based on the operator's query (if any).

The tools available are:

- 'get_video_clip_from_user_query': Use this tool to retrieve a video clip from
  the CCTV footage based on the operator's natural-language query (e.g. "show me
  the moment someone fell on the platform").
- 'get_video_clip_from_image': Use this tool to retrieve a video clip from the
  CCTV footage based on a reference image provided by the operator (e.g. a
  screenshot of a person of interest).
- 'ask_question_about_video': Use this tool to answer a question about the
  footage by retrieving relevant frame captions and transcripts from the
  'video_context'.

# Additional rules:
- If the operator has provided an image, you should always use the
  'get_video_clip_from_image' tool.

# Current information:
- Is image provided: {is_image_provided}
"""

GENERAL_SYSTEM_PROMPT = """
Your name is SmartGuard, an AI assistant for an AI-powered CCTV incident
auditing platform serving public transit systems (subways, trains, and buses).

You help transit security operators and auditors review footage, investigate
incidents, and answer general questions about CCTV operations, video processing,
and transit safety procedures.

Be professional, concise, and focused on safety and operational accuracy.
When relevant, reference common transit incident categories such as: fights or
physical altercations, falls or medical emergencies, unattended or abandoned
bags, crowd crush or overcrowding, vandalism or property damage, loitering or
trespassing in restricted areas, fare evasion or gate jumping, and slip-and-fall
hazards.
"""


def routing_system_prompt() -> str:
    _prompt_id = "routing-system-prompt"
    try:
        prompt = client.get_prompt(_prompt_id)
        if prompt is None:
            prompt = client.create_prompt(
                name=_prompt_id,
                prompt=ROUTING_SYSTEM_PROMPT,
            )
            logger.info(f"System prompt created. \n {prompt.commit=} \n {prompt.prompt=}")
        return prompt.prompt
    except Exception:
        logger.warning("Couldn't retrieve prompt from Opik, check credentials! Using hardcoded prompt.")
        logger.warning(f"Using hardcoded prompt: {ROUTING_SYSTEM_PROMPT}")
        prompt = ROUTING_SYSTEM_PROMPT
    return prompt


def tool_use_system_prompt() -> str:
    _prompt_id = "tool-use-system-prompt"
    try:
        prompt = client.get_prompt(_prompt_id)
        if prompt is None:
            prompt = client.create_prompt(
                name=_prompt_id,
                prompt=TOOL_USE_SYSTEM_PROMPT,
            )
            logger.info(f"System prompt created. \n {prompt.commit=} \n {prompt.prompt=}")
        return prompt.prompt
    except Exception:
        logger.warning("Couldn't retrieve prompt from Opik, check credentials! Using hardcoded prompt.")
        logger.warning(f"Using hardcoded prompt: {TOOL_USE_SYSTEM_PROMPT}")
        prompt = TOOL_USE_SYSTEM_PROMPT
    return prompt


def general_system_prompt() -> str:
    _prompt_id = "general-system-prompt"
    try:
        prompt = client.get_prompt(_prompt_id)
        if prompt is None:
            prompt = client.create_prompt(
                name=_prompt_id,
                prompt=GENERAL_SYSTEM_PROMPT,
            )
            logger.info(f"System prompt created. \n {prompt.commit=} \n {prompt.prompt=}")
        return prompt.prompt
    except Exception:
        logger.warning("Couldn't retrieve prompt from Opik, check credentials! Using hardcoded prompt.")
        logger.warning(f"Using hardcoded prompt: {GENERAL_SYSTEM_PROMPT}")
        prompt = GENERAL_SYSTEM_PROMPT
    return prompt
