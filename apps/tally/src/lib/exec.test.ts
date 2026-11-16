import { describe, expect, it } from "vitest";
import { createRunner, runCommand } from "./exec";

describe("runCommand", () => {
  it("resolves with standard output", async () => {
    const output = await runCommand(process.execPath, ["-e", "process.stdout.write('hello')"]);

    expect(output).toBe("hello");
  });

  it("rejects with the command and its standard error", async () => {
    const failure = runCommand(process.execPath, ["-e", "console.error('boom'); process.exit(2)"]);

    await expect(failure).rejects.toThrow(/boom/);
  });

  it("stops a command that outlives the time limit and says so", async () => {
    const run = createRunner(50);

    const hungCommand = run(process.execPath, ["-e", "setTimeout(() => {}, 5000)"]);

    await expect(hungCommand).rejects.toThrow(/timed out after 50 ms/);
  });
});
