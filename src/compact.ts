import type { Message } from './agent.ts';
import { client, MODEL } from './client.ts';
const KEEP_USER_TURNS = 5;

export const compact = async (messages: Message[]): Promise<Message[]> => {
  let userMessages: number[] = [];
  for (let index = 0; index < messages.length; index++) {
    const m = messages[index];
    if (m?.role === 'user') {
      userMessages.push(index);
    }
  }

  const start = userMessages[userMessages.length - KEEP_USER_TURNS];

  if (userMessages.length <= KEEP_USER_TURNS || !start) {
    return messages;
  }
  const oldMessages = messages.slice(1, start);
  const asks = [];
  const conclusions = [];
  for (const oldMessage of oldMessages) {
    if (oldMessage.role === 'user') {
      asks.push(oldMessage.content.toString());
    }
    if (oldMessage.role === 'assistant' && !oldMessage.tool_calls?.length) {
      conclusions.push(oldMessage.content);
    }
  }

  const draft =
    '【更早对话摘要】\n提问：' +
    asks.join('；') +
    '\n结论：' +
    conclusions
      .filter((c): c is string => typeof c === 'string' && c.length > 0)
      .join('；')
      .slice(0, 500);
  let text = '';
  try {
    text =
      (
        await client.chat.completions.create({
          model: MODEL,
          messages: [
            {
              role: 'system',
              content:
                '你是压缩器。只用下面素材写短摘要。 保留已出现的数字和结论。禁止编造、禁止补明细。',
            },
            {
              role: 'user',
              content: draft,
            },
          ],
        })
      ).choices[0]?.message?.content || '';
  } catch (error) {}

  const summary = text ? '【更早对话摘要】\n' + text : draft;

  const window = [
    {
      role: 'user',
      content: summary,
    } as Message,
    { role: 'assistant', content: '已了解摘要，继续当前问题。' } as Message,
    ...messages.slice(start),
  ];
  if (messages[0]?.role === 'system' && start > 0) {
    return [messages[0], ...window];
  }
  return window;
};
