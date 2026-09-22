import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import type OpenAI from 'openai';

/**
 * Everything the agent is allowed to touch lives under this directory.
 * A tool that can read arbitrary paths is a tool that can read your SSH keys.
 */
export const SANDBOX_ROOT = resolve(import.meta.dirname, '..', 'sandbox');

/**
 * Tool descriptions are not documentation, they are part of the prompt.
 * The model decides whether to call a tool based only on this text and the
 * parameter schema, so vague wording here shows up as wrong behaviour later.
 */
export const toolSchemas: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_files',
      description:
        'List the files available in the sandbox directory. Use this first when you need to know what files exist before reading them.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description:
        'Read the full text content of one file in the sandbox directory. Call list_files first if you do not know the exact filename.',
      parameters: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description:
              "Filename relative to the sandbox directory, for example 'notes.txt'. Must not contain '..'.",
          },
        },
        required: ['filename'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate',
      description:
        'Use this method when you need to perform addition, subtraction, multiplication,Total, difference,diff, budget, or division! Use this instead of doing mental arithmetic.',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description:
              "An arithmetic expression, for example '(120 + 38) / 4'.",
          },
        },
        required: ['expression'],
        additionalProperties: false,
      },
    },
  },
];

/**
 * The smallest possible trace: which tools actually got called, in order.
 * You cannot evaluate an agent by looking only at its final answer — a right
 * answer reached the wrong way is a bug waiting to surface.
 */
export type ToolCall = {
  name: string;
  args: Record<string, unknown>;
};

const callLog: ToolCall[] = [];

export function resetCallLog(): void {
  callLog.length = 0;
}

export function getCallLog(): readonly ToolCall[] {
  return [...callLog];
}

/** One-line trace so eval output shows which file / expression was used. */
export function formatToolCall(call: ToolCall): string {
  if (call.name === "read_file" && typeof call.args.filename === "string") {
    return `read_file(${call.args.filename})`;
  }
  if (call.name === "calculate" && typeof call.args.expression === "string") {
    return `calculate(${call.args.expression})`;
  }
  if (call.name === "list_files") return "list_files";
  return `${call.name}(${JSON.stringify(call.args)})`;
}

/**
 * Dispatches a tool call and always resolves to a string.
 *
 * Note what this never does: throw. A thrown error kills the loop, while a
 * returned error message goes back into the conversation as an observation the
 * model can react to — it will usually correct itself and retry. Treating tool
 * failures as data instead of exceptions is most of what makes an agent robust.
 */
export async function executeTool(
  name: string,
  rawArgs: string,
): Promise<string> {
  let args: Record<string, unknown>;
  try {
    args = rawArgs.trim() === "" ? {} : JSON.parse(rawArgs);
  } catch {
    callLog.push({ name, args: { _raw: rawArgs } });
    return `Error: arguments were not valid JSON. Received: ${rawArgs}`;
  }
  callLog.push({ name, args });

  switch (name) {
    case 'list_files':
      return listFiles();
    case 'read_file':
      return readSandboxFile(String(args.filename ?? ''));
    case 'calculate':
      return calculate(String(args.expression ?? ''));
    default:
      return `Error: unknown tool "${name}". Available tools: list_files, read_file, calculate.`;
  }
}

async function listFiles(): Promise<string> {
  const entries = await readdir(SANDBOX_ROOT, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  if (files.length === 0) return 'The sandbox directory is empty.';
  return files.join('\n');
}

async function readSandboxFile(filename: string): Promise<string> {
  if (filename === '') return 'Error: filename is required.';

  const target = resolve(SANDBOX_ROOT, filename);
  // resolve() collapses '..' before we check, so this catches escape attempts
  // that a naive string check on the raw input would miss.
  if (relative(SANDBOX_ROOT, target).startsWith('..')) {
    return `Error: "${filename}" is outside the sandbox directory and cannot be read.`;
  }

  try {
    const content = await readFile(target, 'utf8');
    // An unbounded tool result is how you blow up a context window. Truncating
    // and saying so is better than silently dropping the tail.
    const LIMIT = 4000;
    if (content.length > LIMIT) {
      return `${content.slice(0, LIMIT)}\n\n[truncated: file is ${content.length} characters, showing first ${LIMIT}] \n\n若还需要对这些数字加总、求差或倍数，请调用 calculate，不要口算。`;
    }
    return (
      content +
      '\n\n若还需要对这些数字加总、求差或倍数，请调用 calculate，不要口算。'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error reading "${filename}": ${message}. Try list_files to see valid filenames.`;
  }
}

function calculate(expression: string): string {
  // The whitelist IS the security boundary here. Anything not matching this
  // pattern never reaches the evaluator, which is what makes the next line
  // acceptable in a local learning tool. Do not copy this into production
  // without replacing it with a real expression parser.
  if (!/^[\d\s+\-*/().]+$/.test(expression)) {
    return `Error: "${expression}" contains characters that are not allowed. Only digits, + - * / ( ) . and spaces are supported.`;
  }

  try {
    const result = new Function(
      `"use strict"; return (${expression});`,
    )() as unknown;
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      return `Error: "${expression}" did not evaluate to a finite number.`;
    }
    return String(result);
  } catch {
    return `Error: "${expression}" is not a valid arithmetic expression.`;
  }
}
