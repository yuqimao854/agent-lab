import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const file = resolve(import.meta.dirname, '..', 'web', 'index.html');

createServer(async (_req, res) => {
  const html = await readFile(file);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
}).listen(5173, () => console.log('web http://127.0.0.1:5173'));
