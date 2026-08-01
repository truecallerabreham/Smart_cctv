import ZAI from "z-ai-web-dev-sdk";

const zai = await ZAI.create();

Bun.serve({
  port: 3040,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
    }
    if (url.pathname === "/v1/models") {
      return Response.json({ object: "list", data: [{ id: "glm-4.6", object: "model" }, { id: "glm-4v", object: "model" }] });
    }
    if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
      try {
        const body = await req.json();
        const messages = body.messages || [];
        const model = body.model || "glm-4.6";
        const tools = body.tools;
        const toolChoice = body.tool_choice;

        // Detect if any message contains image_url content (vision request)
        const hasImage = messages.some((m: any) =>
          Array.isArray(m.content) && m.content.some((c: any) => c.type === "image_url")
        );

        let response;
        if (hasImage) {
          // Vision request — use z-ai createVision
          const visionMessages = messages.map((m: any) => {
            if (Array.isArray(m.content)) {
              const textPart = m.content.find((c: any) => c.type === "text");
              const imagePart = m.content.find((c: any) => c.type === "image_url");
              return { role: m.role, content: textPart?.text || "", imageUrl: imagePart?.image_url?.url || "" };
            }
            return { role: m.role, content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) };
          });

          response = await zai.chat.completions.createVision({
            model: "glm-4v",
            messages: visionMessages,
            thinking: { type: "disabled" },
          });
        } else {
          // Text-only request — use z-ai chat completions
          const zaiMessages = messages.map((m: any) => ({
            role: m.role,
            content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
          }));

          const createParams: any = {
            model: model,
            messages: zaiMessages,
            max_tokens: body.max_tokens || 4096,
          };

          // Pass tools through if provided
          if (tools) {
            createParams.tools = tools;
          }
          if (toolChoice) {
            createParams.tool_choice = toolChoice;
          }

          response = await zai.chat.completions.create(createParams);
        }

        const choice = response.choices[0];
        const message = choice?.message || {};

        // Check if the response contains tool_calls
        let toolCalls = message.tool_calls;
        
        // If no native tool_calls but the text looks like a JSON tool call, parse it
        if (!toolCalls && tools && message.content) {
          const content = message.content.trim();
          // Try to extract JSON tool call from text
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/^(\{[\s\S]*\})$/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[1]);
              if (parsed.name && parsed.parameters) {
                toolCalls = [{
                  id: `call_${Date.now()}`,
                  type: "function",
                  function: {
                    name: parsed.name,
                    arguments: JSON.stringify(parsed.parameters),
                  },
                }];
              }
            } catch {
              // Not valid JSON tool call, leave as text
            }
          }
        }

        const responseData: any = {
          id: `chatcmpl-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: model,
          choices: [{
            index: 0,
            message: {
              role: "assistant",
              content: message.content || "",
              ...(toolCalls ? { tool_calls: toolCalls } : {}),
            },
            finish_reason: toolCalls ? "tool_calls" : "stop",
          }],
          usage: response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        };

        return Response.json(responseData);
      } catch (e) {
        console.error("Proxy error:", e);
        return Response.json({ error: { message: String(e) } }, { status: 500 });
      }
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  },
});
console.log("LLM+VLM proxy running on http://localhost:3040");
