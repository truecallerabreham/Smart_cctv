#!/bin/bash
cd /home/z/my-project/smartguard

# Start MCP server (port 9090)
smartguard-mcp/.venv/bin/python -m smartguard_mcp.server --port 9090 --host 0.0.0.0 > /tmp/mcp.log 2>&1 &
MCP_PID=$!
echo "MCP started (PID $MCP_PID)"

# Wait for MCP to be ready
sleep 10

# Start API server (port 8080)
smartguard-api/.venv/bin/python -m smartguard_api.api --port 8080 --host 0.0.0.0 > /tmp/api.log 2>&1 &
API_PID=$!
echo "API started (PID $API_PID)"

# Wait for API to be ready
sleep 5

# Start UI (port 3000)
cd smartguard-ui
bun run dev > /tmp/ui.log 2>&1 &
UI_PID=$!
echo "UI started (PID $UI_PID)"

echo "All services started. Waiting..."
# Keep the script alive so children don't get orphaned
wait
