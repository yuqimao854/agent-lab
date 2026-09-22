/** Tiny terminal helpers so you can watch the loop turn. */

/** The eval runner sets QUIET=1 so 30 runs do not bury the results. */
const quiet = process.env.QUIET === "1";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

export function logStep(step: number): void {
  if (quiet) return;
  console.log(dim(`\n──────── step ${step} ────────`));
}

export function logThinking(content: string | null): void {
  if (quiet || !content) return;
  console.log(`${cyan("assistant")} ${content}`);
}

export function logToolCall(name: string, args: string): void {
  if (quiet) return;
  console.log(`${yellow("→ call")} ${name}(${args})`);
}

export function logToolResult(result: string): void {
  if (quiet) return;
  const preview = result.length > 300 ? `${result.slice(0, 300)}…` : result;
  console.log(`${dim("← result")} ${preview.replace(/\n/g, "\n          ")}`);
}

export function logFinal(content: string): void {
  if (quiet) return;
  console.log(`\n${green("✓ final answer")}\n${content}\n`);
}
