import { createServer } from 'node:http';
import { SYSTEM_PROMPT, runAgentTurn, type Message } from './agent.ts';

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/chat') {
    res.writeHead(404).end();
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const { prompt } = JSON.parse(Buffer.concat(chunks).toString()) as {
    prompt?: string;
  };
  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt ?? '' },
  ];
  const answer = await runAgentTurn(messages);
  res
    .writeHead(200, { 'Content-Type': 'application/json' })
    .end(JSON.stringify({ answer }));
});

server.listen(8787, () => console.log('api http://127.0.0.1:8787'));
