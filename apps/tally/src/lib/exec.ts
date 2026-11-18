import { execFile } from "node:child_process";

export type Runner = (command: string, args: string[]) => Promise<string>;

export class CommandError extends Error {
  constructor(
    command: string,
    args: string[],
    readonly reason: string,
    readonly printed: string,
  ) {
    super(`${command} ${args.join(" ")} failed: ${reason}`);
    this.name = "CommandError";
  }
}

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
            reject(new CommandError(command, args, reason, stdout));
            return;
          }
          resolve(stdout);
        },
      );
    });
}

export const runCommand: Runner = createRunner();
