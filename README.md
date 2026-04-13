# Project 9: L'Oréal Routine Builder

L'Oréal is expanding what is possible with AI, and now your chatbot is getting smarter.
This project is a product-aware routine builder where users can browse products,
select what they want, generate a personalized routine, and ask follow-up questions.

## Web Search Integration

This project supports real-time web search via Cloudflare Workers and the OpenAI Responses API.

1. Deploy `worker-web-search.js` to Cloudflare Workers.
2. Add a worker secret named `OPENAI_API_KEY`.
3. In `secrets.js`, set:

```js
window.CLOUDFLARE_WORKER_URL = "https://your-worker-subdomain.workers.dev/";
```

The frontend displays assistant answers plus source links/citations returned by the worker.
