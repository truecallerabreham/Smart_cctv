#!/bin/bash
# SmartGuard full pipeline test — runs everything in one process tree
cd /home/z/my-project/smartguard

# Kill old processes
pkill -9 -f "smartguard" 2>/dev/null
pkill -9 -f "pixeltable" 2>/dev/null
pkill -9 -f "vite" 2>/dev/null
pkill -9 -f "bun.*index" 2>/dev/null
sleep 3

# Clean old data
rm -rf /home/z/.pixeltable .records cache_* shared_media/re_*

# Reduce frame count for faster processing
sed -i 's/SPLIT_FRAMES_COUNT: int = 5/SPLIT_FRAMES_COUNT: int = 3/' smartguard-mcp/src/smartguard_mcp/config.py

echo "=== 1. Start LLM+VLM proxy (port 3040) ==="
cd mini-services/llm-proxy
bun run index.ts > /tmp/llm-proxy.log 2>&1 &
PROXY_PID=$!
cd /home/z/my-project/smartguard
sleep 4
echo "Proxy PID: $PROXY_PID, status: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3040/v1/models)"

echo "=== 2. Start MCP server (port 9090) ==="
smartguard-mcp/.venv/bin/python -m smartguard_mcp.server --port 9090 --host 0.0.0.0 > /tmp/mcp.log 2>&1 &
MCP_PID=$!
sleep 12
echo "MCP PID: $MCP_PID, status: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:9090/mcp)"

echo "=== 3. Start API server (port 8080) ==="
smartguard-api/.venv/bin/python -m smartguard_api.api --port 8080 --host 0.0.0.0 > /tmp/api.log 2>&1 &
API_PID=$!
sleep 12
echo "API PID: $API_PID, status: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/)"

echo "=== 4. Start UI (port 3000) ==="
cd smartguard-ui
bun run dev > /tmp/ui.log 2>&1 &
UI_PID=$!
cd /home/z/my-project/smartguard
sleep 5
echo "UI PID: $UI_PID, status: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)"

echo ""
echo "=== 5. Test general chat (Incident 1) ==="
CHAT1=$(curl -s -X POST http://localhost:8080/chat -H "Content-Type: application/json" -d '{"message": "Hello, what can you help me with?"}')
echo "$CHAT1" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Incident 1 (general chat):'); print(d.get('message','ERROR')[:300])" 2>&1
echo "$CHAT1" > /tmp/chat1.json

echo ""
echo "=== 6. Upload video (Incident 2) ==="
UPLOAD_RESP=$(curl -s -X POST http://localhost:8080/upload-video -F "file=@shared_media/sample_transit.mp4")
VIDEO_PATH=$(echo "$UPLOAD_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['video_path'])" 2>/dev/null)
echo "Uploaded: $VIDEO_PATH"

echo "=== 7. Process video ==="
PROCESS_RESP=$(curl -s -X POST http://localhost:8080/process-video -H "Content-Type: application/json" -d "{\"video_path\": \"$VIDEO_PATH\"}")
TASK_ID=$(echo "$PROCESS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['task_id'])" 2>/dev/null)
echo "Task ID: $TASK_ID"

echo "=== 8. Poll for processing completion ==="
for i in $(seq 1 30); do
  sleep 15
  STATUS=$(curl -s "http://localhost:8080/task-status/$TASK_ID" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "fail")
  echo "Poll $i ($((${i}*15))s): $STATUS"
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then break; fi
done
echo "Final processing status: $STATUS"

echo ""
echo "=== 9. Test tool-use chat — get clip (Incident 3) ==="
CHAT2=$(curl -s -X POST http://localhost:8080/chat -H "Content-Type: application/json" -d "{\"message\": \"Show me the clip where something interesting happens\", \"video_path\": \"$VIDEO_PATH\"}")
echo "$CHAT2" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('Incident 3 (tool-use clip retrieval):')
print('Message:', d.get('message','ERROR')[:300])
print('Clip path:', d.get('clip_path', 'None'))
" 2>&1
echo "$CHAT2" > /tmp/chat2.json

echo ""
echo "=== 10. Check if clip file exists ==="
if [ -f "/tmp/chat2.json" ]; then
  CLIP=$(python3 -c "import json; d=json.load(open('/tmp/chat2.json')); print(d.get('clip_path','') or '')" 2>/dev/null)
  if [ -n "$CLIP" ] && [ "$CLIP" != "None" ]; then
    CLIP_FILE="shared_media/$(basename $CLIP)"
    echo "Clip file: $CLIP_FILE"
    ls -la "$CLIP_FILE" 2>/dev/null && echo "CLIP EXISTS!" || echo "Clip file not found"
  else
    echo "No clip returned"
  fi
fi

echo ""
echo "=== 11. MCP log (last 20) ==="
tail -20 /tmp/mcp.log

echo ""
echo "=== 12. API log (last 20) ==="
tail -20 /tmp/api.log

echo ""
echo "=== ALL DONE — services still running ==="
echo "Proxy: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3040/v1/models)"
echo "MCP: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:9090/mcp)"
echo "API: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/)"
echo "UI: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)"
