import { runAgent } from "./agent.ts";
import { logFinal } from "./log.ts";
import { MODEL, PROVIDER_LABEL } from "./client.ts";

const prompt = process.argv.slice(2).join(" ").trim();

if (prompt === "") {
  console.error('Usage: pnpm agent "your question here"');
  console.error('Example: pnpm agent "sandbox 里哪个文件最长？一共多少字符？"');
  process.exit(1);
}

console.log(`endpoint: ${PROVIDER_LABEL}`);
console.log(`model:    ${MODEL}`);
console.log(`task:     ${prompt}`);

const answer = await runAgent(prompt);
logFinal(answer);
