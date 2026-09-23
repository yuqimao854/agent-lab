import { SYSTEM_PROMPT, runAgentTurn, type Message } from "./agent.ts";
import { resetCallLog, getCallLog, formatToolCall } from "./tools.ts";
import { MODEL, PROVIDER_LABEL } from "./client.ts";

/**
 * 六轮会话：第 6 问回头问一月总额。
 * KEEP_USER_TURNS=5，此时第一轮已出窗，答案应来自摘要，不得再读 january。
 *
 * 跑：pnpm eval:compact
 */

const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];

function didRead(filename: string): boolean {
  return getCallLog().some(
    (c) => c.name === "read_file" && c.args.filename === filename,
  );
}

function hasJanTotal(text: string): boolean {
  return /675[.,]2/.test(text.replace(/,(?=\d{3})/g, ""));
}

/** 前 5 轮只负责把窗口填满；对错不影响第 6 轮验收。 */
const warmup: string[] = [
  "一月一共花了多少钱？",
  "和二月差多少？",
  "预算是多少？超了吗？",
  "二月咖啡多少？",
  "咖啡加出租车多少？",
];

console.log(`\nprovider: ${PROVIDER_LABEL}`);
console.log(`model:    ${MODEL}`);
console.log("compact:  填满 5 次 user 后，再问一月总额\n");

for (let i = 0; i < warmup.length; i++) {
  resetCallLog();
  messages.push({ role: "user", content: warmup[i]! });
  const answer = await runAgentTurn(messages);
  const trace = getCallLog().map(formatToolCall).join(" → ");
  console.log(`turn ${i + 1}  ${warmup[i]}`);
  console.log(`  trace  ${trace || "(没调工具)"}`);
  console.log(`  answer ${answer.replace(/\s+/g, " ").slice(0, 120)}\n`);
}

resetCallLog();
messages.push({ role: "user", content: "一月份一共多少钱？" });
const turn6 = await runAgentTurn(messages);
const turn6Trace = getCallLog().map(formatToolCall).join(" → ");
const turn6Ok = hasJanTotal(turn6);
const rereadJan = didRead("expenses-january.txt");
const fromSummary = turn6Ok && !rereadJan;

console.log(`turn 6  一月份一共多少钱？  ${fromSummary ? "✓" : "✗"}`);
console.log(`  trace  ${turn6Trace || "(没调工具)"}`);
console.log(`  answer ${turn6.replace(/\s+/g, " ").slice(0, 120)}\n`);

console.log("─".repeat(58));
console.log(`第六轮答案含 675.2         ${turn6Ok ? "pass" : "FAIL"}`);
console.log(
  `第六轮没有重读 january    ${!rereadJan ? "pass" : "FAIL — 摘要没有生效"}`,
);
console.log("─".repeat(58));

if (!fromSummary) process.exit(1);
