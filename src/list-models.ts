import { client, PROVIDER_LABEL } from "./client.ts";

/**
 * Model ids change constantly. Rather than trusting a name someone wrote in a
 * blog post, ask your own account what it can actually reach.
 */
const page = await client.models.list();
const ids = page.data.map((m) => m.id).sort();

console.log(`${ids.length} models visible at ${PROVIDER_LABEL}:\n`);
for (const id of ids) console.log(`  ${id}`);
console.log("\nPut one of these in OPENAI_MODEL in your .env file.");
console.log("Not every model supports tool calling — if the agent never calls a");
console.log("tool, that is the first thing to suspect.");
