import { SYSTEM_PROMPT, runAgentTurn, type Message } from './agent.ts';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { logFinal } from './log.ts';

const messages: Message[] = [{ role: 'system', content: SYSTEM_PROMPT }];
const rl = createInterface({ input: stdin, output: stdout });

console.log('输入问题开始。空行或 exit 结束。\n');

while (true) {
  const line = (await rl.question('你: ')).trim();
  if (line === '' || line === 'exit' || line === 'quit') break;

  messages.push({ role: 'user', content: line });
  const answer = await runAgentTurn(messages);
  logFinal(answer);
}

rl.close();
