import OpenAI from "openai";

/**
 * Hosted OpenAI and local Ollama speak the same wire protocol, so switching
 * between them is only a matter of where baseURL points. That is why this file
 * is separate from agent.ts: the loop should not care who is answering.
 *
 *   hosted : OPENAI_API_KEY=sk-...        (leave OPENAI_BASE_URL unset)
 *   local  : OPENAI_BASE_URL=http://localhost:11434/v1
 *            OPENAI_API_KEY=ollama        (Ollama ignores it, but the SDK
 *                                          refuses to start without a value)
 */

// A trailing slash here becomes a double slash in every request path. Ollama
// tolerates it; not every gateway does.
const baseURL = process.env.OPENAI_BASE_URL?.replace(/\/+$/, "");
const apiKey = process.env.OPENAI_API_KEY;
const isLocal = Boolean(baseURL);

if (!apiKey || apiKey.includes("replace-me")) {
  console.error(
    "Missing OPENAI_API_KEY.\n" +
      "Copy .env.example to .env and fill it in. The key must never be\n" +
      "hardcoded in a source file or pasted into a chat window.",
  );
  process.exit(1);
}

if (!isLocal && !apiKey.startsWith("sk-")) {
  console.error(
    `OPENAI_API_KEY is "${apiKey}", which is not a hosted OpenAI key, and\n` +
      "OPENAI_BASE_URL is not set — requests would go to api.openai.com and\n" +
      "fail with 401.\n\n" +
      "For a local model, set:\n" +
      "  OPENAI_BASE_URL=http://localhost:11434/v1",
  );
  process.exit(1);
}

export const client = new OpenAI({
  apiKey,
  ...(baseURL ? { baseURL } : {}),
  // A 4B model on a laptop is slow. Slow is not the same as broken, and a
  // default 10-minute-feeling hang is worse than an honest timeout.
  timeout: isLocal ? 180_000 : 60_000,
  maxRetries: 1,
});

export const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export const PROVIDER_LABEL = baseURL ?? "https://api.openai.com/v1";
