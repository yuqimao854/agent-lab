import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { executeTool } from './tools.ts';
import { z } from 'zod';

// 这一步： 创建 server 实例。还不要连 transport、不要登记工具。
const server = new McpServer({
  name: 'agent-lab',
  version: '0.1.0',
});
server.registerTool(
  'list_files',
  {
    description:
      'List the files available in the sandbox directory. Use this first when you need to know what files exist before reading them.',
  },
  async () => {
    const text = await executeTool('list_files', '{}');
    return { content: [{ type: 'text', text }] };
  },
);
server.registerTool(
  'read_file',
  {
    description: '读取 sandbox 里一个文件的全文。不知道文件名时先 list_files。',
    inputSchema: z.object({
      filename: z
        .string()
        .describe("相对 sandbox 的文件名，例如 'notes.txt'，不能包含 '..'"),
    }),
  },
  async ({ filename }) => {
    const text = await executeTool('read_file', JSON.stringify({ filename }));
    return { content: [{ type: 'text', text }] };
  },
);
server.registerTool(
  'calculate',
  {
    description: '接收一条算式，返回一个数；加总、求差、倍数都用我。',
    inputSchema: z.object({
      expression: z.string().describe("算术表达式，例如 '(120 + 38) / 4'"),
    }),
  },
  async ({ expression }) => {
    const text = await executeTool('calculate', JSON.stringify({ expression }));
    return { content: [{ type: 'text', text }] };
  },
);

// server 接到标准输入输出上。 没有这行，进程只是登记了工具，外面连不上。
const transport = new StdioServerTransport();
await server.connect(transport);

// pnpm dlx @modelcontextprotocol/inspector node --experimental-strip-types src/mcp-server.ts
