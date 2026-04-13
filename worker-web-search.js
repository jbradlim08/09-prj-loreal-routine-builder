// Cloudflare Worker: OpenAI Web Search Proxy for the Routine Builder
// Deploy this worker and set OPENAI_API_KEY as a Cloudflare secret.
// The frontend should POST: { messages: [{ role, content }, ...] }
// The worker responds with: { answer: string, citations: [{ title, url }] }

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed. Use POST." }),
        { status: 405, headers: corsHeaders }
      );
    }

    try {
      const apiKey = env.OPENAI_API_KEY;
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "Missing OPENAI_API_KEY secret in worker." }),
          { status: 500, headers: corsHeaders }
        );
      }

      const payload = await request.json();
      const messages = Array.isArray(payload?.messages) ? payload.messages : [];
      if (messages.length === 0) {
        return new Response(
          JSON.stringify({ error: "Missing messages array in request body." }),
          { status: 400, headers: corsHeaders }
        );
      }

      const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1",
          input: messages,
          tools: [{ type: "web_search_preview" }],
        }),
      });

      const data = await openAIResponse.json();
      if (!openAIResponse.ok) {
        return new Response(JSON.stringify(data), {
          status: openAIResponse.status,
          headers: corsHeaders,
        });
      }

      const answer = data.output_text || "";
      const citations = extractCitations(data);

      return new Response(JSON.stringify({ answer, citations }), {
        headers: corsHeaders,
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Worker request failed.",
          detail: error?.message || "Unknown error",
        }),
        { status: 500, headers: corsHeaders }
      );
    }
  },
};

function extractCitations(responseData) {
  const seen = new Set();
  const results = [];
  const outputs = Array.isArray(responseData?.output) ? responseData.output : [];

  for (const outputItem of outputs) {
    const contentItems = Array.isArray(outputItem?.content)
      ? outputItem.content
      : [];

    for (const contentItem of contentItems) {
      const annotations = Array.isArray(contentItem?.annotations)
        ? contentItem.annotations
        : [];

      for (const annotation of annotations) {
        if (annotation?.type !== "url_citation" || !annotation?.url) continue;
        if (seen.has(annotation.url)) continue;

        seen.add(annotation.url);
        results.push({
          title: annotation.title || annotation.url,
          url: annotation.url,
        });
      }
    }
  }

  return results;
}
