import type OpenAI from 'openai';
import { client, MODEL } from './client.ts';
import { executeTool, recordToolCall } from './tools.ts';
import { logStep, logThinking, logToolCall, logToolResult } from './log.ts';
import { compact } from './compact.ts';
import { connectMcp, toOpenAITools } from './mcp-client.ts';
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
  const mcp = await connectMcp();
  const { tools } = await mcp.listTools();
  const mcpTools = toOpenAITools(tools);

  try {
    for (let step = 1; step <= MAX_STEPS; step++) {
      logStep(step);
      // ────────────────────────────────────────────────────────────────────

      const newMessage = (
        await client.chat.completions.create({
          model: MODEL,
          messages: await compact(messages),
          tools: mcpTools,
        })
      ).choices[0]?.message;

      if (newMessage) {
        messages.push(newMessage);
        logThinking(newMessage?.content);
      }

      if (newMessage && !newMessage?.tool_calls?.length) {
        return newMessage.content || '';
      }

      for (const call of newMessage?.tool_calls || []) {
        const name = call.function.name;
        const args = call.function.arguments;
        logToolCall(name, args);
        const parsed = !args || args.trim() === '' ? {} : JSON.parse(args);
        recordToolCall(name, parsed);

        const result = await mcp.callTool({
          name,
          arguments: parsed,
        });
        const parts = Array.isArray(result.content) ? result.content : [];

        const text =
          parts
            ?.map((part) => (part.type === 'text' ? part.text : ''))
            .join('') ?? '';
        logToolResult(text);
        messages.push({ role: 'tool', tool_call_id: call.id, content: text });
      }
    }
  } finally {
    await mcp.close();
  }

  return `到达 ${MAX_STEPS} 步上限仍未得出答案。任务可能太复杂，或者工具设计有问题让模型在原地打转。`;
}
