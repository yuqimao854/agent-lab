import { runAgent } from "./agent.ts";
import { resetCallLog, getCallLog } from "./tools.ts";
import { MODEL, PROVIDER_LABEL } from "./client.ts";

/**
 * 最小可用的 eval harness。
 *
 * 它回答一个问题，而这个问题靠"再跑一次看看"是永远答不出来的：
 * 我刚才那个改动，到底让 agent 变好了还是变坏了？
 *
 * 跑：pnpm eval          （每个用例 3 次）
 *     RUNS=10 pnpm eval  （每个用例 10 次，更可信但更慢）
 */

type Case = {
  id: string;
  prompt: string;
  /** 最终答案里必须出现的数字。 */
  expect: RegExp;
  /** 为了可信地得到这个答案，必须用到的工具。 */
  mustCall: string[];
};

const CASES: Case[] = [
  {
    id: "jan-total",
    prompt: "一月一共花了多少钱？",
    expect: /675[.,]2/,
    mustCall: ["read_file", "calculate"],
  },
  {
    id: "month-diff",
    prompt: "一月和二月的总支出相差多少钱？",
    expect: /255[.,]9/,
    mustCall: ["read_file", "calculate"],
  },
  {
    id: "coffee-x3",
    prompt: "二月的咖啡开销乘以 3 是多少？",
    expect: /\b111\b/,
    mustCall: ["read_file", "calculate"],
  },
];

const RUNS = Number(process.env.RUNS ?? 3);

type Result = {
  correct: boolean;
  calledAll: boolean;
  tools: readonly string[];
  answer: string;
  error?: string;
};

async function runOnce(c: Case): Promise<Result> {
  resetCallLog();
  try {
    const answer = await runAgent(c.prompt);
    const tools = getCallLog();
    const normalized = answer.replace(/,(?=\d{3})/g, "");
    return {
      correct: c.expect.test(normalized),
      calledAll: c.mustCall.every((t) => tools.includes(t)),
      tools,
      answer: answer.replace(/\s+/g, " ").slice(0, 70),
    };
  } catch (error) {
    return {
      correct: false,
      calledAll: false,
      tools: getCallLog(),
      answer: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const pct = (n: number, total: number) => `${Math.round((n / total) * 100)}%`.padStart(4);

console.log(`\nprovider: ${PROVIDER_LABEL}`);
console.log(`model:    ${MODEL}`);
console.log(`runs:     ${RUNS} per case, ${CASES.length * RUNS} total\n`);

let totalCorrect = 0;
let totalCalled = 0;
let totalRuns = 0;
const started = Date.now();

for (const c of CASES) {
  process.stdout.write(`${c.id.padEnd(12)} `);
  const results: Result[] = [];

  for (let i = 0; i < RUNS; i++) {
    const r = await runOnce(c);
    results.push(r);
    // 每跑完一次画一个字符，这样你知道它在动
    process.stdout.write(r.error ? "!" : r.correct && r.calledAll ? "✓" : r.correct ? "~" : "✗");
  }

  const correct = results.filter((r) => r.correct).length;
  const called = results.filter((r) => r.calledAll).length;
  totalCorrect += correct;
  totalCalled += called;
  totalRuns += RUNS;

  console.log(`  答案正确 ${pct(correct, RUNS)}   用对工具 ${pct(called, RUNS)}`);

  // 把每次实际调了哪些工具列出来，这是诊断信息，不是装饰
  for (const [i, r] of results.entries()) {
    const trace = r.tools.length > 0 ? r.tools.join(" → ") : "(没调任何工具)";
    const mark = r.error ? "ERR" : r.correct ? " ok" : "BAD";
    console.log(`  ${mark} #${i + 1}  ${trace}`);
    if (r.error) console.log(`        ${r.error}`);
    else if (!r.correct) console.log(`        答成了：${r.answer}`);
  }
  console.log();
}

const elapsed = Math.round((Date.now() - started) / 1000);

console.log("─".repeat(58));
console.log(`答案正确率  ${pct(totalCorrect, totalRuns)}   (${totalCorrect}/${totalRuns})`);
console.log(`用对工具率  ${pct(totalCalled, totalRuns)}   (${totalCalled}/${totalRuns})`);
console.log(`耗时        ${elapsed}s`);
console.log("─".repeat(58));
console.log(`
这两个数字是分开的，因为它们说的是两件事：

  答案正确率低 → agent 不好用。
  答案正确但用对工具率低 → agent 这次侥幸蒙对了，你不能依赖它。

第二种更危险，因为它在测试里看起来是绿的。
改动 tools.ts 的 description 或 agent.ts 的 SYSTEM_PROMPT 之后重跑，
比较的是这两个数字，不是"感觉好像顺了"。
`);
