import {
  type ChildProcess,
  type ChildProcessWithoutNullStreams,
  execFile,
  spawn,
} from "node:child_process";
import { closeSync, mkdirSync, openSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { commandEnvironment, withoutRepositoryVariables } from "./git-env";

export type RunOptions = { cwd?: string; input?: string; timeoutMs?: number };

export type Runner = (command: string, args: string[], options?: RunOptions) => Promise<string>;

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

const MAX_OUTPUT_BYTES = 256 * 1024 * 1024;
const GH_TIMEOUT_MS = 120_000;

export function defaultTimeoutMs(command: string): number {
  return command === "gh" ? GH_TIMEOUT_MS : 0;
}

export const runCommand: Runner = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const timeoutMs = options.timeoutMs ?? defaultTimeoutMs(command);
    const child = execFile(
      command,
      args,
      {
        cwd: options.cwd,
        env: commandEnvironment(command, args, process.env),
        maxBuffer: MAX_OUTPUT_BYTES,
        encoding: "utf8",
        timeout: timeoutMs,
      },
      (error, stdout, stderr) => {
        if (error) {
          const reason = error.killed ? `timed out after ${timeoutMs} ms` : stderr || error.message;
          reject(new CommandError(command, args, reason, stdout));
          return;
        }
        resolve(stdout);
      },
    );
    if (options.input !== undefined) child.stdin?.end(options.input);
  });

export type SpawnOptions = { cwd: string; env?: Record<string, string> };

const INHERITED_VARIABLES = [
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "TERM",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TMPDIR",
  "TZ",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "GOPATH",
  "GOROOT",
  "GOCACHE",
  "GOMODCACHE",
  "CARGO_HOME",
  "RUSTUP_HOME",
];

function inheritedEnvironment(): NodeJS.ProcessEnv {
  const source = withoutRepositoryVariables(process.env);
  return Object.fromEntries(
    INHERITED_VARIABLES.flatMap((name) => {
      const value = source[name];
      return value === undefined ? [] : [[name, value]];
    }),
  ) as NodeJS.ProcessEnv;
}

export function spawnProcess(
  command: string,
  args: string[],
  options: SpawnOptions,
): ChildProcessWithoutNullStreams {
  return spawn(command, args, {
    cwd: options.cwd,
    env: { ...inheritedEnvironment(), ...options.env },
    stdio: "pipe",
  });
}

type DetachedOptions = { logPath: string; env?: Record<string, string> };

export function spawnDetached(
  command: string,
  args: string[],
  options: DetachedOptions,
): ChildProcess {
  mkdirSync(path.dirname(options.logPath), { recursive: true });
  const log = openSync(options.logPath, "w", 0o600);
  const child = spawn(command, args, {
    cwd: homedir(),
    env: { ...inheritedEnvironment(), ...options.env },
    detached: true,
    stdio: ["ignore", log, log],
  });
  closeSync(log);
  child.unref();
  return child;
}
