import type OpenAI from 'openai';
import { client, MODEL } from './client.ts';
import { toolSchemas, executeTool } from './tools.ts';
import { logStep, logThinking, logToolCall, logToolResult } from './log.ts';
import { compact } from './compact.ts';

/**
 * ============================================================================
 *  这个文件是你要亲手写的部分。其他文件我都写好了，不用改。
 *
 *  你要实现的是 agent 的本质：一个 while 循环。没有别的。
 *  下面的骨架把顺序标出来了，五个 TODO，照着填。
 *
 *  跑起来：先 pnpm install，再 pnpm agent "你的问题"
 * ============================================================================
 */

/** 循环上限。没有这个，一个想不通的模型能把你的额度烧干。 */
const MAX_STEPS = 10;

export const SYSTEM_PROMPT = `You are a helpful assistant with access to a small sandbox of text files.

Rules:
- 摘要里没有、历史里也没有算过的，才必须用工具.
- Use the calculate tool for arithmetic instead of computing in your head.
-对话里已有「【更早对话摘要】」或助手已经给出过总额，不要再读同一份文件、不要再 calculate，直接用摘要/结论里的数字回答。
- 从文件取出数字后必须 calculate 工具计算，不要自己计算.
`;

export type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export async function runAgent(userPrompt: string): Promise<string> {
  // 对话历史。整个 agent 的"记忆"就是这个数组 —— 它会随着每一轮变长，
  // 模型每次看到的都是它的全部内容。后面你学上下文工程，管的就是这个数组。
  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];

  return runAgentTurn(messages);
}

export async function runAgentTurn(messages: Message[]): Promise<string> {
  for (let step = 1; step <= MAX_STEPS; step++) {
    logStep(step);
    // ────────────────────────────────────────────────────────────────────
    // TODO 1：调模型
    //
    // 用 client.chat.completions.create({ ... })，需要传三个东西：
    //   model    → 用上面 import 进来的 MODEL
    //   messages → 当前的对话历史
    //   tools    → toolSchemas，这就是"模型怎么知道有哪些工具可用"的答案
    //
    // 拿到 response 之后，你要的东西在 response.choices[0].message 里。
    // ────────────────────────────────────────────────────────────────────
    // console.log('压缩后的对话======>', compact(messages));
    const newMessage = (
      await client.chat.completions.create({
        model: MODEL,
        messages: await compact(messages),
        tools: toolSchemas,
      })
    ).choices[0]?.message;
    // ────────────────────────────────────────────────────────────────────
    // TODO 2：把模型这一轮的回复原样 push 进 messages
    //
    // 注意"原样"。不要只取 content，整个 message 对象都要进去，因为里面的
    // tool_calls 字段是下一步的凭据 —— 少了它，你 push 的 tool 结果会对不上号，
    // API 会直接报错。这是新手第一个必踩的坑。
    // ────────────────────────────────────────────────────────────────────
    if (newMessage) {
      messages.push(newMessage);
      logThinking(newMessage?.content);
    }
    // 这行帮你把模型说的话打出来，方便观察。变量名按你上面取的改。

    // ────────────────────────────────────────────────────────────────────
    // TODO 3：判断要不要结束
    //
    // 如果 message.tool_calls 是空的（模型不再要求调工具了），说明它认为
    // 任务完成了 —— 这就是循环的终止条件。直接 return message.content。
    // ────────────────────────────────────────────────────────────────────
    if (newMessage && !newMessage?.tool_calls?.length) {
      return newMessage.content || '';
    }

    // ────────────────────────────────────────────────────────────────────
    // TODO 4：执行工具，把结果喂回去
    //
    // message.tool_calls 是个数组，模型可能一轮要求调好几个。遍历它，对每一个：
    //   1. 取出 call.function.name 和 call.function.arguments（后者是 JSON 字符串）
    //   2. logToolCall(name, args) 打出来看看
    //   3. await executeTool(name, args) 拿到结果字符串
    //   4. logToolResult(result)
    //   5. push 一条消息回 messages，形状是：
    //        { role: "tool", tool_call_id: call.id, content: result }
    //
    for (const call of newMessage?.tool_calls || []) {
      const name = call.function.name;
      const args = call.function.arguments;
      logToolCall(name, args);
      const result = await executeTool(name, args);
      logToolResult(result);
      messages.push({ role: 'tool', tool_call_id: call.id, content: result });
    }

    // 第 5 步的 role 和 tool_call_id 就是第二个验收问题的答案：工具结果不是以
    // 用户身份、也不是以模型身份回到对话里的，它有自己的角色，并且必须用 id
    // 跟发起它的那次调用配对。
    // ────────────────────────────────────────────────────────────────────

    // ────────────────────────────────────────────────────────────────────
    // TODO 5：什么都不用写。
    //
    // for 循环自己会转到下一轮，而下一轮模型看到的 messages 里已经多了
    // 它自己的请求和工具的回答。它就是这样"知道"上一步发生了什么的。
    // 这就是 agent 的全部秘密。
    // ────────────────────────────────────────────────────────────────────
  }

  return `到达 ${MAX_STEPS} 步上限仍未得出答案。任务可能太复杂，或者工具设计有问题让模型在原地打转。`;
}
