import type { Message } from './agent.ts';
const KEEP_USER_TURNS = 5;

export const compact = (messages: Message[]): Message[] => {
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
  const window = messages.slice(start);
  if (messages[0]?.role === 'system' && start > 0) {
    return [messages[0], ...window];
  }
  return window;
};
