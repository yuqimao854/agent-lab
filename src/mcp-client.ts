import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// const client = new Client({
//   name: 'agent-lab-client',
//   version: '0.1.0',
// });

// const transport = new StdioClientTransport({
//   command: 'node',
//   args: ['--experimental-strip-types', 'src/mcp-server.ts'],
// });

// // 这一步：握手。 在 transport 和 client 都建好之后加：
//
// const { tools } = await client.listTools();
// console.log(tools.map((t) => t.name));
// const result = await client.callTool({
//   name: 'list_files',
//   arguments: {},
// });

// console.log('---------', result);
// // ：问完就关掉。 否则子进程还在，终端会一直挂着。
// const openaiTools = tools.map((t) => ({
//   type: 'function' as const,
//   function: {
//     name: t.name,
//     description: t.description ?? '',
//     parameters: t.inputSchema,
//   },
// }));
// console.log(JSON.stringify(openaiTools, null, 2));
// await client.close();
export function toOpenAITools(
  tools: Awaited<ReturnType<Client['listTools']>>['tools'],
) {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description ?? '',
      parameters: t.inputSchema,
    },
  }));
}

export async function connectMcp() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['--experimental-strip-types', 'src/mcp-server.ts'],
  });

  const mcp = new Client({
    name: 'agent-lab-client',
    version: '0.1.0',
  });
  await mcp.connect(transport);
  return mcp;
}

// if (process.argv[1]?.includes('mcp-client')) {
//   const mcp = await connectMcp();

//   const { tools } = await mcp.listTools();
//   console.log(JSON.stringify(toOpenAITools(tools), null, 2));

//   await mcp.close();
// }
