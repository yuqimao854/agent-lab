import { client, MODEL, PROVIDER_LABEL } from "./client.ts";
import { toolSchemas } from "./tools.ts";

/**
 * Before blaming your loop, check that the model can do the one thing the loop
 * depends on: emit a well-formed tool_call. This makes a single request with a
 * prompt that has no correct answer other than calling list_files.
 *
 * Run with: pnpm probe
 */
console.log(`provider: ${PROVIDER_LABEL}`);
console.log(`model:    ${MODEL}\n`);

const started = Date.now();

const response = await client.chat.completions.create({
  model: MODEL,
  messages: [
    {
      role: "system",
      content:
        "You have tools available. Always use them to answer questions about files. Never guess.",
    },
    { role: "user", content: "What files are in the sandbox directory?" },
  ],
  tools: toolSchemas,
});

const elapsed = Date.now() - started;
const message = response.choices[0]?.message;
const calls = message?.tool_calls ?? [];

console.log(`latency:  ${elapsed} ms`);
console.log(`content:  ${JSON.stringify(message?.content)}`);
console.log(`finish:   ${response.choices[0]?.finish_reason}\n`);

if (calls.length === 0) {
  console.log("✗ FAIL — no tool_calls returned.");
  console.log("  The model answered with prose instead of requesting a tool.");
  console.log("  A loop built on this will never call anything. Change models.");
  process.exit(1);
}

let ok = true;
for (const call of calls) {
  const name = call.function.name;
  const rawArgs = call.function.arguments;
  const known = toolSchemas.some((t) => t.function.name === name);

  let parsed: unknown = null;
  let parseError: string | null = null;
  try {
    parsed = rawArgs.trim() === "" ? {} : JSON.parse(rawArgs);
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  console.log(`tool_call id=${call.id}`);
  console.log(`  name:  ${name} ${known ? "✓ known" : "✗ hallucinated"}`);
  console.log(`  args:  ${rawArgs}`);
  console.log(
    parseError === null
      ? `  json:  ✓ parses to ${JSON.stringify(parsed)}`
      : `  json:  ✗ ${parseError}`,
  );

  if (!known || parseError !== null) ok = false;
}

console.log(
  ok
    ? "\n✓ PASS — this model can drive the loop. Expected tool here: list_files."
    : "\n✗ FAIL — malformed tool call. This model will fight you the whole way.",
);
