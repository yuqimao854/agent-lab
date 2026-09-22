import { SYSTEM_PROMPT, runAgentTurn, type Message } from "./agent.ts";
import { resetCallLog, getCallLog, formatToolCall } from "./tools.ts";
import { MODEL, PROVIDER_LABEL } from "./client.ts";

/**
 * 双轮会话评测：同一份 messages 连问两句。
 * 第二轮不得再读 january——那笔账应已在历史里。
 *
 * 跑：pnpm eval:session
 */

const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];

function didRead(filename: string): boolean {
  return getCallLog().some(
    (c) => c.name === "read_file" && c.args.filename === filename,
  );
}

console.log(`\nprovider: ${PROVIDER_LABEL}`);
console.log(`model:    ${MODEL}`);
console.log("session:  一月总额 → 和二月相差多少\n");

resetCallLog();
messages.push({ role: "user", content: "一月一共花了多少钱？" });
const turn1 = await runAgentTurn(messages);
const turn1Trace = getCallLog().map(formatToolCall).join(" → ");
const turn1Ok = /675[.,]2/.test(turn1.replace(/,(?=\d{3})/g, ""));
const turn1ReadJan = didRead("expenses-january.txt");

console.log(`turn 1  ${turn1Ok && turn1ReadJan ? "✓" : "✗"}`);
console.log(`  trace  ${turn1Trace || "(没调工具)"}`);
console.log(`  answer ${turn1.replace(/\s+/g, " ").slice(0, 120)}\n`);

resetCallLog();
messages.push({ role: "user", content: "和二月差多少？" });
const turn2 = await runAgentTurn(messages);
const turn2Trace = getCallLog().map(formatToolCall).join(" → ");
const turn2Ok = /255[.,]9/.test(turn2.replace(/,(?=\d{3})/g, ""));
const rereadJan = didRead("expenses-january.txt");
const readFeb = didRead("expenses-february.txt");
const memoryOk = !rereadJan;

console.log(`turn 2  ${turn2Ok && memoryOk && readFeb ? "✓" : "✗"}`);
console.log(`  trace  ${turn2Trace || "(没调工具)"}`);
console.log(`  answer ${turn2.replace(/\s+/g, " ").slice(0, 120)}\n`);

console.log("─".repeat(58));
console.log(`第一轮答案含 675.2     ${turn1Ok ? "pass" : "FAIL"}`);
console.log(`第一轮读过 january      ${turn1ReadJan ? "pass" : "FAIL"}`);
console.log(`第二轮答案含 255.9     ${turn2Ok ? "pass" : "FAIL"}`);
console.log(`第二轮读过 february     ${readFeb ? "pass" : "FAIL"}`);
console.log(
  `第二轮没有重读 january  ${memoryOk ? "pass" : "FAIL — 会话没有生效"}`,
);
console.log("─".repeat(58));

const ok = turn1Ok && turn1ReadJan && turn2Ok && memoryOk && readFeb;
if (!ok) process.exit(1);
