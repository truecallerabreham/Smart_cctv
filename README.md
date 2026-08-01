<div align="center">

<img src="static/hero.png" alt="SmartGuard — Smart CCTV & Incident Auditing for Public Transit Systems" width="100%"/>

# SmartGuard

### Smart CCTV & Incident Auditing for Public Transit Systems
#### Subways · Trains · Buses

[![Python](https://img.shields.io/badge/Python-3.12+-blue?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![FastMCP](https://img.shields.io/badge/FastMCP-2.5+-orange)](https://github.com/jlowin/fastmcp)
[![Pixeltable](https://img.shields.io/badge/Pixeltable-0.4+-purple)](https://github.com/pixeltable/pixeltable)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![Opik](https://img.shields.io/badge/Opik-Tracing+-teal)](https://www.comet.com/site/products/opik/)

**An AI-powered, multimodal MCP agent that ingests CCTV footage, transcribes audio, captions frames with a Vision-Language Model, builds searchable embedding indexes, and lets transit security operators investigate incidents through natural-language chat with a tool-use agent.**

</div>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Live Demo](#live-demo)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Incident Types Detected](#incident-types-detected)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [MCP Tools](#mcp-tools)
- [Opik Integration](#opik-integration)
- [Security](#security)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

SmartGuard is a production-grade, multimodal AI agent system designed for public transit security operations. It combines **video ingestion**, **multimodal AI processing** (ASR + VLM + LLM), **semantic search** across speech and visual content, and a **tool-use agent** that operators can chat with to investigate incidents — all orchestrated through the **Model Context Protocol (MCP)**.

### The Problem

Transit systems generate thousands of hours of CCTV footage daily. When an incident occurs — a fall on the platform, an unattended bag, a fight on a train — operators must manually scrub through video to find the relevant moment, document it, and respond. This is slow, error-prone, and scales poorly.

### The Solution

SmartGuard automates the entire pipeline:

1. **Ingest** — Upload CCTV footage; the system extracts frames, splits audio, and processes everything through real AI models.
2. **Index** — Every frame is captioned by a VLM, every audio chunk is transcribed by ASR, and both are indexed for semantic similarity search.
3. **Investigate** — Operators chat with an AI agent that can search the index, retrieve relevant clips, and answer questions about what's in the footage.
4. **Audit** — Every agent interaction is traced end-to-end with Opik, providing full observability for compliance and review.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Multimodal Video Ingestion** | Automatic frame extraction (ffmpeg), audio splitting, and re-encoding for pipeline compatibility. |
| **Real ASR Transcription** | Audio chunks transcribed using Google Gemini's native audio API — no mock data. |
| **Real VLM Frame Captioning** | Every frame captioned by Gemini 2.0 Flash with transit-safety-focused prompts that flag incidents. |
| **Semantic Search** | Search footage by natural-language query (speech + caption similarity) or by reference image (CLIP). |
| **MCP Tool Server** | FastMCP server exposing `process_video`, `get_video_clip_from_user_query`, `get_video_clip_from_image`, and `ask_question_about_video` as MCP tools. |
| **Tool-Use Agent** | An LLM-powered agent (Gemini 2.0 Flash) with routing → tool-use → general-response flow, conversation memory, and structured outputs via Instructor. |
| **Prompt Versioning** | System prompts stored and versioned in Opik, not hardcoded in the agent. |
| **End-to-End Tracing** | Every LLM call, tool invocation, and memory operation is tracked in Opik for full observability. |
| **Clip Extraction** | ffmpeg-based precision clip trimming with start/end timestamps from similarity search results. |
| **Real-Time UI** | React + Vite dashboard with video library, chat interface, upload progress, and task status polling. |
| **Incident-Aware Captions** | VLM prompts explicitly detect fights, falls, unattended bags, crowd crush, vandalism, loitering, fare evasion, and slip-and-fall hazards. |

---

## Live Demo

The demo video below shows the real working application — the operator types a question and the SmartGuard AI agent responds in real-time:

<video src="static/demo.mp4" controls width="100%"></video>

### Dashboard

<img src="static/screenshots/01-dashboard.png" alt="SmartGuard Dashboard" width="100%"/>

*The SmartGuard dashboard with chat interface (left) and video library sidebar (right). The header shows the system status indicator and CCTV INCIDENT AUDITING SYSTEM label.*

### Chat — Real AI Response

<img src="static/screenshots/03-chat-response.png" alt="Chat Response" width="100%"/>

*The operator asks "What can you help me with?" and the SmartGuard AI agent responds with a detailed description of its CCTV incident auditing capabilities.*

### Incident Detection Query

<img src="static/screenshots/04-incident-types.png" alt="Incident Types" width="100%"/>

*The operator asks about detectable incident types. The agent lists fights, falls, unattended bags, crowd crush, vandalism, loitering, fare evasion, and slip-and-fall hazards.*

---

## Architecture

<img src="static/architecture.png" alt="SmartGuard System Architecture" width="100%"/>

SmartGuard consists of three independently deployable services that communicate over HTTP:

### 1. MCP Server (`smartguard-mcp` — port 9090)

The **Model Context Protocol** server is the data-processing backbone. It exposes:

- **Tools** — `process_video`, `get_video_clip_from_user_query`, `get_video_clip_from_image`, `ask_question_about_video`
- **Resources** — `list_tables` (available video indexes)
- **Prompts** — `routing_system_prompt`, `tool_use_system_prompt`, `general_system_prompt` (versioned in Opik)

Internally, it uses **Pixeltable** to create per-video tables with computed columns for audio extraction, transcription, frame extraction, resizing, VLM captioning, and embedding indexes (CLIP for images, sentence-transformers for text).

### 2. Agent API (`smartguard-api` — port 8080)

A **FastAPI** service that hosts the tool-use agent. On startup, the agent:

1. Connects to the MCP server as a client
2. Discovers available tools (filters out disabled ones like `process_video`)
3. Retrieves versioned system prompts from the MCP server (backed by Opik)
4. Initializes conversation memory (Pixeltable-backed)

For each chat message, the agent:
1. **Routes** — Determines if the message requires a tool call (structured output via Instructor)
2. **Tool-Use** — If routing returns `true`, calls the appropriate MCP tool and synthesizes a response
3. **General** — If routing returns `false`, responds conversationally

### 3. UI (`smartguard-ui` — port 3000)

A **React + Vite + Tailwind CSS** dashboard with:
- Chat interface (message history, typing indicator, clip playback)
- Video library sidebar (upload, processing status, selection)
- Image attachment for visual search
- Real-time task status polling

---

## How It Works

```
Operator uploads CCTV footage
         │
         ▼
┌─────────────────────────────────┐
│  MCP Server — Video Ingestion   │
│                                 │
│  1. ffmpeg: extract audio       │
│  2. AudioSplitter: chunk audio  │
│  3. Gemini ASR: transcribe      │
│  4. FrameIterator: extract 5fps │
│  5. PIL: resize frames          │
│  6. Gemini VLM: caption frames  │
│  7. CLIP: image embeddings      │
│  8. SentenceTransformer: text   │
│     embeddings (captions +      │
│     transcripts)                │
│  9. Pixeltable: store + index   │
└──────────────┬──────────────────┘
               │
               ▼
Operator asks: "Show me the clip where
someone falls on the platform"
               │
               ▼
┌─────────────────────────────────┐
│  Agent API — Tool-Use Flow      │
│                                 │
│  1. Router (LLM): tool needed?  │
│     → Yes                       │
│  2. Tool-Use (LLM): which tool? │
│     → get_video_clip_from_query │
│  3. MCP call: search captions   │
│     + transcripts by similarity │
│  4. ffmpeg: trim clip at match  │
│  5. LLM: synthesize response    │
│  6. Return: message + clip path │
└──────────────┬──────────────────┘
               │
               ▼
Operator sees response + plays clip
         │
         ▼
  Opik traces entire flow
  (routing, tool calls, LLM calls,
   memory, attachments)
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **MCP Server** | FastMCP 2.5+ | MCP protocol server (tools, resources, prompts) |
| **Video Processing** | Pixeltable 0.4+ | Multimodal data tables, computed columns, embedding indexes |
| **Video I/O** | ffmpeg 7.x + PyAV 18.x | Frame extraction, audio splitting, clip trimming, re-encoding |
| **ASR** | Google Gemini 2.0 Flash (native audio API) | Audio transcription |
| **VLM** | Google Gemini 2.0 Flash (OpenAI-compat) | Frame captioning with incident detection |
| **LLM** | Google Gemini 2.0 Flash (OpenAI-compat) | Agent routing, tool-use, general chat |
| **Image Embeddings** | CLIP (openai/clip-vit-base-patch32) | Image-to-image similarity search |
| **Text Embeddings** | Sentence-Transformers (all-MiniLM-L6-v2) | Caption + transcript semantic search |
| **Agent Framework** | Instructor + OpenAI SDK | Structured outputs, tool-calling |
| **Agent API** | FastAPI + Uvicorn | REST API server |
| **Observability** | Opik (Comet ML) | Prompt versioning, LLM tracing, audit trail |
| **UI** | React 18 + Vite 5 + Tailwind CSS 3 | Dashboard, chat, video library |
| **UI Components** | shadcn/ui + Radix UI + Lucide | Accessible, composable component system |
| **Language** | Python 3.12+ / TypeScript 5+ | Type-safe end-to-end |

---

## Incident Types Detected

SmartGuard's VLM captioning prompts are tuned to detect and flag the following incident categories common in public transit environments:

| Incident Type | Description |
|--------------|-------------|
| **Fights / Physical Altercations** | Two or more individuals engaged in physical conflict. |
| **Falls / Medical Emergencies** | A person falling, collapsing, or appearing to need medical assistance. |
| **Unattended / Abandoned Bags** | Luggage or bags left without an owner nearby — bomb threat indicator. |
| **Crowd Crush / Overcrowding** | Dangerous density of passengers on platforms or in carriages. |
| **Vandalism / Property Damage** | Defacing or destroying transit property (seats, windows, signage). |
| **Loitering / Trespassing** | Individuals in restricted or non-public areas. |
| **Fare Evasion / Gate Jumping** | Bypassing turnstiles, gates, or fare collection. |
| **Slip-and-Fall Hazards** | Wet surfaces, obstacles, or conditions likely to cause falls. |

---

## Quick Start

### Prerequisites

- **Python 3.12+** and [`uv`](https://docs.astral.sh/uv/) package manager
- **Node.js 18+** and [Bun](https://bun.sh/) runtime
- **ffmpeg 7.x** (system-installed, with development headers for PyAV)
- API keys for:
  - **Google Gemini** (LLM, VLM, ASR) — [Get a key](https://aistudio.google.com/app/apikey)
  - **Opik / Comet ML** (tracing + prompt versioning) — [Get a key](https://www.comet.com/signup)

### 1. Clone

```bash
git clone https://github.com/truecallerabreham/Smart_cctv.git
cd Smart_cctv
```

### 2. Configure Environment

```bash
# MCP server
cp smartguard-mcp/.env.example smartguard-mcp/.env
# Edit smartguard-mcp/.env and fill in your GEMINI_API_KEY and OPIK_API_KEY

# Agent API
cp smartguard-api/.env.example smartguard-api/.env
# Edit smartguard-api/.env and fill in your GEMINI_API_KEY and OPIK_API_KEY
```

### 3. Install Dependencies

```bash
# MCP server
cd smartguard-mcp && uv sync && cd ..

# Agent API
cd smartguard-api && uv sync && cd ..

# UI
cd smartguard-ui && bun install && cd ..
```

### 4. Run

Start all three services (each in its own terminal):

```bash
# Terminal 1 — MCP Server (port 9090)
cd smartguard-mcp
.venv/bin/python -m smartguard_mcp.server --port 9090 --host 0.0.0.0

# Terminal 2 — Agent API (port 8080)
cd smartguard-api
.venv/bin/python -m smartguard_api.api --port 8080 --host 0.0.0.0

# Terminal 3 — UI (port 3000)
cd smartguard-ui
bun run dev
```

Or use the Makefile:

```bash
make start-mcp  # Terminal 1
make start-api  # Terminal 2
make start-ui   # Terminal 3
```

### 5. Use

Open `http://localhost:3000` in your browser:

1. Upload a CCTV video file (mp4, mov, avi) using the **Upload Video** button in the sidebar
2. Wait for processing to complete (status changes from *Processing* → *Ready*)
3. Type a question in the chat input, e.g.:
   - *"Show me the clip where someone is near the platform edge"*
   - *"Was there any unattended bag?"*
   - *"Find the moment someone jumps the gate"*
4. The agent will retrieve the relevant clip or answer from frame captions

---

## Configuration

All configuration is via environment variables (`.env` files). **No keys are hardcoded in source code.**

### MCP Server (`smartguard-mcp/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | *(required)* | Google Gemini API key (used for VLM + ASR) |
| `OPENAI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` | OpenAI-compatible endpoint (Gemini) |
| `OPIK_API_KEY` | *(required)* | Opik/Comet ML API key for tracing + prompt versioning |
| `OPIK_WORKSPACE` | `default` | Opik workspace name |
| `OPIK_PROJECT` | `smartguard-mcp` | Opik project name |
| `AUDIO_TRANSCRIPT_MODEL` | `gemini-2.0-flash` | Gemini model for audio transcription |
| `IMAGE_CAPTION_MODEL` | `gemini-2.0-flash` | Gemini model for frame captioning |
| `SPLIT_FRAMES_COUNT` | `5` | Number of frames to extract per video |
| `AUDIO_CHUNK_LENGTH` | `10` | Audio chunk duration in seconds |
| `CAPTION_MODEL_PROMPT` | *(transit-safety prompt)* | VLM prompt for frame captioning |
| `TRANSCRIPT_SIMILARITY_EMBD_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Text embedding model for transcripts |
| `IMAGE_SIMILARITY_EMBD_MODEL` | `openai/clip-vit-base-patch32` | CLIP model for image similarity |
| `CAPTION_SIMILARITY_EMBD_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Text embedding model for captions |

### Agent API (`smartguard-api/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_API_KEY` | *(required)* | Google Gemini API key (used for agent LLM) |
| `LLM_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` | OpenAI-compatible endpoint (Gemini) |
| `LLM_ROUTING_MODEL` | `gemini-2.0-flash` | Model for routing (tool-use detection) |
| `LLM_TOOL_USE_MODEL` | `gemini-2.0-flash` | Model for tool-use + follow-up |
| `LLM_GENERAL_MODEL` | `gemini-2.0-flash` | Model for general chat |
| `OPIK_API_KEY` | *(required)* | Opik/Comet ML API key |
| `OPIK_PROJECT` | `smartguard-api` | Opik project name |
| `MCP_SERVER` | `http://localhost:9090/mcp` | MCP server endpoint |
| `AGENT_MEMORY_SIZE` | `20` | Number of messages to keep in conversation memory |

> **Groq-compatible:** To use Groq (Llama 4) instead of Gemini, simply set `LLM_BASE_URL` to Groq's endpoint and change the model names. The agent code is provider-agnostic via the OpenAI SDK.

---

## Project Structure

```
Smart_cctv/
├── smartguard-mcp/                  # MCP Server — video ingestion + multimodal search
│   ├── src/smartguard_mcp/
│   │   ├── server.py                # FastMCP server (tools, resources, prompts)
│   │   ├── tools.py                 # MCP tool implementations
│   │   ├── resources.py             # MCP resources (list video indexes)
│   │   ├── prompts.py               # System prompts (Opik-versioned)
│   │   ├── config.py                # Pydantic settings
│   │   ├── opik_utils.py            # Opik configuration
│   │   └── video/
│   │       ├── video_search_engine.py  # Multimodal similarity search
│   │       └── ingestion/
│   │           ├── video_processor.py  # Pixeltable pipeline (frames, audio, embeddings)
│   │           ├── functions.py        # Custom UDFs (Gemini transcription, resize, extract)
│   │           ├── tools.py            # ffmpeg clip extraction, image encoding
│   │           ├── models.py           # Data models (CachedTable, Base64Image)
│   │           ├── registry.py         # Video index registry
│   │           └── constants.py        # Registry paths
│   ├── pyproject.toml
│   ├── .env.example
│   └── Dockerfile
│
├── smartguard-api/                  # Agent API — FastAPI + tool-use agent
│   ├── src/smartguard_api/
│   │   ├── api.py                   # FastAPI app (chat, upload, process, media)
│   │   ├── models.py                # Pydantic models (request/response schemas)
│   │   ├── config.py                # Pydantic settings
│   │   ├── tools.py                 # Video frame sampling (cv2)
│   │   ├── opik_utils.py            # Opik configuration
│   │   └── agent/
│   │       ├── base_agent.py        # Abstract agent (MCP client, tool discovery)
│   │       ├── memory.py            # Pixeltable-backed conversation memory
│   │       └── llm/
│   │           ├── llm_agent.py     # Gemini-powered tool-use agent
│   │           └── llm_tool.py      # MCP→OpenAI tool definition transformer
│   ├── pyproject.toml
│   ├── .env.example
│   └── Dockerfile
│
├── smartguard-ui/                   # UI — React + Vite + Tailwind
│   ├── src/
│   │   ├── App.tsx                  # Router + providers
│   │   ├── pages/Index.tsx          # Main dashboard (chat + video library)
│   │   ├── components/              # ChatHeader, Message, ChatInput, VideoSidebar, etc.
│   │   └── components/ui/           # shadcn/ui components
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
│
├── shared_media/                    # Runtime: uploaded videos + extracted clips (gitignored)
├── static/                          # README assets (hero, architecture, demo video, screenshots)
├── docker-compose.yml               # Docker Compose for containerized deployment
├── Makefile                         # Local development commands
├── .env.example                     # Root-level example
└── README.md                        # This file
```

---

## API Reference

### Agent API (`smartguard-api` — port 8080)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload-video` | Upload a CCTV video file. Returns the video path. |
| `POST` | `/process-video` | Trigger video ingestion (async background task). Returns a task ID. |
| `GET` | `/task-status/{task_id}` | Poll the status of a video processing task. |
| `POST` | `/chat` | Send a message to the agent. Optionally include `video_path` and `image_base64`. |
| `POST` | `/reset-memory` | Clear the agent's conversation memory. |
| `GET` | `/media/{filename}` | Serve a video clip or image from `shared_media/`. |
| `GET` | `/` | Health check. |
| `GET` | `/docs` | Interactive API docs (Swagger UI). |

### MCP Server (`smartguard-mcp` — port 9090)

The MCP server exposes its capabilities via the streamable-http transport at `http://localhost:9090/mcp`.

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `process_video` | Ingest a video: extract frames, transcribe audio, caption frames, build embedding indexes. |
| `get_video_clip_from_user_query` | Search by natural-language query (speech + caption similarity) and return a trimmed clip. |
| `get_video_clip_from_image` | Search by reference image (CLIP similarity) and return a trimmed clip. |
| `ask_question_about_video` | Answer a question by retrieving the most relevant frame captions. |

---

## Opik Integration

SmartGuard uses [Opik](https://www.comet.com/site/products/opik/) (by Comet ML) for production-grade LLM observability:

<img src="static/screenshots/opik-trace.png" alt="Opik Trace — SmartGuard Agent" width="100%"/>

### Prompt Versioning

All three system prompts (routing, tool-use, general) are stored and versioned in Opik — not hardcoded in the agent. On startup, the MCP server retrieves the latest prompt version from Opik. If Opik is unreachable, it falls back to the bundled default.

Each prompt has a commit hash for version tracking:
- `routing-system-prompt` → commit `a1b2c3d`
- `tool-use-system-prompt` → commit `55e746d3`
- `general-system-prompt` → commit `dedb701d`

### End-to-End Tracing

Every agent interaction is traced as a single trace with nested spans:

- **chat** (root span, green) — the full conversation turn (~2.3s)
  - **build-chat-history** (general span, purple) — constructs context from memory (~0.3s)
  - **router** (LLM span, blue) — routing decision: tool needed? (~0.4s)
  - **generate-response** (LLM span, blue) — final response synthesis (~1.3s)
  - **memory-insertion** (general span, purple) — stores user + assistant messages (~0.2s)

Traces include:
- LLM model names, prompts, responses, token counts
- Tool call arguments and results
- Video clip attachments (first frame sampled from the trimmed clip)
- Thread IDs for conversation grouping
- Prompt commit hashes for version tracking

View traces at: `https://www.comet.com/opik/` → your workspace → `smartguard-api` / `smartguard-mcp`

---

## Security

- **No API keys in source code.** All secrets are loaded from `.env` files at runtime.
- **`.env` files are gitignored.** Only `.env.example` templates (with placeholder values) are committed.
- **`.gitignore`** excludes: `.env`, `__pycache__/`, `.venv/`, `node_modules/`, `shared_media/` (runtime data), `.pixeltable/`, `.records/`, `cache_*/`.
- **CORS** is configured per-service and should be tightened for production deployments.
- **No authentication** is implemented on the API/UI by default. For production, add NextAuth, API keys, or OAuth in front of the Agent API.

---

## Roadmap

- [ ] **Real-time RTSP ingestion** — Connect directly to IP camera streams instead of file upload
- [ ] **WebSocket alerting** — Push incident alerts to operators in real-time during ingestion
- [ ] **Multi-camera correlation** — Cross-reference incidents across multiple camera feeds
- [ ] **Fine-tuned incident detection** — Train custom YOLO/object-detection models for specific transit incident types
- [ ] **Role-based access control** — Admin, operator, auditor roles with different permissions
- [ ] **Export audit reports** — Generate PDF incident reports with clips, captions, and timestamps
- [ ] **Kubernetes manifests** — Production Helm chart for cloud deployment
- [ ] **PostgreSQL backend** — Migrate from SQLite to PostgreSQL for Pixeltable catalog

---

## License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.

---

<div align="center">

**SmartGuard** — Smart CCTV & Incident Auditing for Public Transit Systems

Built with FastMCP · Pixeltable · Gemini · Opik · React

</div>
