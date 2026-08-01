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
      return Response.json({ object: "list", data: [{ id: "glm-4.6", object: "model" }, { id: "glm-4-plus", object: "model" }] });
    }
    if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
      try {
        const body = await req.json();
        const response = await zai.chat.completions.create({
          model: body.model || "glm-4.6",
          messages: body.messages || [],
          max_tokens: body.max_tokens || 4096,
        });
        return Response.json({
          id: `chatcmpl-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: body.model || "glm-4.6",
          choices: [{ index: 0, message: { role: "assistant", content: response.choices[0]?.message?.content || "" }, finish_reason: "stop" }],
          usage: response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        });
      } catch (e) {
        return Response.json({ error: { message: String(e) } }, { status: 500 });
      }
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  },
});
console.log("LLM proxy running on http://localhost:3040");
