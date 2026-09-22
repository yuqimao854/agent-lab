/**
 * 为什么 forEach(async ...) 在 agent loop 里是个 bug。
 *
 * 不需要 API key，不需要模型，直接跑：
 *   node --experimental-strip-types src/why-foreach-breaks.ts
 */

let tick = 0;
const say = (msg: string) => console.log(`[${String(++tick).padStart(2, "0")}] ${msg}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 假装是 executeTool：要花点时间才有结果。 */
async function fakeTool(name: string, ms: number): Promise<string> {
  await sleep(ms);
  return `${name} 的结果`;
}

const calls = [
  { name: "read_file(january)", ms: 200 },
  { name: "read_file(february)", ms: 50 },
];

// ══════════════════════════════════════════════════════════════════════
console.log("\n═══ A. forEach + async：坏的 ═══\n");
{
  const messages: string[] = [];

  say("外层：开始遍历 2 个 tool_call");
  calls.forEach(async (call) => {
    say(`  回调：${call.name} 开始，遇到 await，交出控制权`);
    const result = await fakeTool(call.name, call.ms);
    messages.push(result);
    say(`  回调：${call.name} 完成，push 进 messages（此时 ${messages.length} 条）`);
  });
  say(`外层：forEach 返回了 —— messages 里有 ${messages.length} 条 tool 结果`);
  say("外层：带着这份 messages 发出下一次 API 请求  ←←← 就是这里炸的");
  say("       历史里有一条 assistant(tool_calls)，却没有任何 tool 消息");
  say("       OpenAI 返回 400: must be followed by tool messages");

  await sleep(400);
  say(`(400ms 后) 回调们终于都跑完了，messages 有 ${messages.length} 条 —— 但请求早发出去了`);
  say(`顺序还反了：${JSON.stringify(messages)}`);
  say("       february 只要 50ms 所以先落地，january 要 200ms 反而在后面");
  say("       tool 消息的顺序和 assistant 里 tool_calls 的顺序对不上");
}

// ══════════════════════════════════════════════════════════════════════
console.log("\n═══ B. for...of + await：对的 ═══\n");
{
  const messages: string[] = [];

  say("外层：开始遍历");
  for (const call of calls) {
    say(`  循环体：${call.name} 开始`);
    const result = await fakeTool(call.name, call.ms);
    messages.push(result);
    say(`  循环体：${call.name} 完成，push 进 messages（此时 ${messages.length} 条）`);
  }
  say(`外层：循环结束 —— messages 里有 ${messages.length} 条，顺序也对`);
  say("外层：现在才发出下一次 API 请求，历史是完整的");
}

// ══════════════════════════════════════════════════════════════════════
console.log("\n═══ C. 附赠：forEach 里抛的错，外面抓不到 ═══\n");
{
  try {
    [1].forEach(async () => {
      throw new Error("工具炸了");
    });
    say("try/catch：什么都没抓到，代码继续往下走了");
  } catch {
    say("try/catch：抓到了（你永远看不到这行）");
  }
  // 这个 rejection 没人处理，Node 会在事件循环里报 unhandled rejection
  await sleep(50);
}

console.log(`
──────────────────────────────────────────────────────────────
结论

forEach 的类型签名是 (callback: (v: T) => void) => void。
它期待回调返回 void，你给它一个返回 Promise<void> 的 async 函数，
它拿到那个 Promise 之后 —— 直接扔掉。

async 函数被调用时，会同步执行到第一个 await，然后立刻返回一个
还没完成的 Promise 给调用方。forEach 不认识它，也不等它，
转头就处理下一个元素，遍历完就 return。

所以关键在这句话：await 只暂停它所在的那个函数，不暂停调用方。
async 不是"让外面等我"，而是"让我内部能暂停"。

TypeScript 不报错，因为 Promise<void> 可以赋给 void 返回类型 ——
这是 TS 为了兼容回调场景故意允许的。想让工具帮你抓，开 ESLint 的
@typescript-eslint/no-misused-promises 规则。
──────────────────────────────────────────────────────────────
`);
