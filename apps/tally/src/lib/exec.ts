import { execFile } from "node:child_process";

export type Runner = (command: string, args: string[]) => Promise<string>;

const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
const COMMAND_TIMEOUT_MS = 120_000;

export function createRunner(timeoutMs: number = COMMAND_TIMEOUT_MS): Runner {
  return (command, args) =>
    new Promise((resolve, reject) => {
      execFile(
        command,
        args,
        { maxBuffer: MAX_OUTPUT_BYTES, encoding: "utf8", timeout: timeoutMs },
        (error, stdout, stderr) => {
          if (error) {
            const reason = error.killed
              ? `timed out after ${timeoutMs} ms`
              : stderr || error.message;
            reject(new Error(`${command} ${args.join(" ")} failed: ${reason}`));
            return;
          }
          resolve(stdout);
        },
      );
    });
}

export const runCommand: Runner = createRunner();
