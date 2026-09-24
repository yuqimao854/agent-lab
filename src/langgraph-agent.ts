import { ChatOpenAI } from '@langchain/openai';
import { MODEL } from './client.ts';
import {
  StateGraph,
  MessagesAnnotation,
  START,
  END,
} from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';

import { tool } from '@langchain/core/tools';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';
import { z } from 'zod';
import { executeTool } from './tools.ts';

export const llm = new ChatOpenAI({
  model: MODEL,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL?.replace(/\/+$/, '') || undefined,
  },
});

// export const graph = new StateGraph(MessagesAnnotation)
// .addNode('callModel', async (state) => {
//   const response = await llm.invoke(state.messages);
//   return { messages: [response] };
// })
// .addEdge(START, 'callModel')
// .addEdge('callModel', END)
// .compile();

//这个只是测试

// const result = await graph.invoke({
//   messages: [new HumanMessage('你好')],
// });
// const last = result.messages.at(-1);
// console.log(last?.content);

const listFilesTool = tool(async () => executeTool('list_files', '{}'), {
  name: 'list_files',
  description: '列出 sandbox 里的文件。不知道有哪些文件时先用我。',
  schema: z.object({}),
});

const readFileTool = tool(
  async ({ filename }) =>
    executeTool('read_file', JSON.stringify({ filename })),
  {
    name: 'read_file',
    description: '读取 sandbox 里一个文件的全文。',
    schema: z.object({ filename: z.string() }),
  },
);

const calculateTool = tool(
  async ({ expression }) =>
    executeTool('calculate', JSON.stringify({ expression })),
  {
    name: 'calculate',
    description: '接收一条算式，返回一个数。',
    schema: z.object({ expression: z.string() }),
  },
);
const tools = [listFilesTool, readFileTool, calculateTool];

//绑定工具
const llmWithTools = llm.bindTools(tools);

export const graph = new StateGraph(MessagesAnnotation)
  .addNode('callModel', async (state) => {
    const response = await llmWithTools.invoke(state.messages);
    return { messages: [response] };
  })
  .addNode('tools', new ToolNode(tools))
  .addEdge(START, 'callModel')
  .addConditionalEdges('callModel', toolsCondition)
  .addEdge('tools', 'callModel')
  .compile();

//这个只是测试

if (process.argv[1]?.includes('langgraph-agent')) {
  const result = await graph.invoke({
    messages: [new HumanMessage('一月份花了多少钱')],
  });
  const last = result.messages.at(-1);
  console.log(last?.content);
}
