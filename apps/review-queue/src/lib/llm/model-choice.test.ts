import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { llmConfig, chooseModel } from "./model-choice";

const SIZES = {
  "9b": {
    model: "qwen3.5-9b-mtp-cc",
    memory_gb: 9,
    mlx: "mlx-community/Qwen3.5-9B-4bit",
    thinking: false,
  },
  "35b": {
    model: "qwen3.6-35b-cc",
    memory_gb: 22,
    mlx: "mlx-community/Qwen3.6-35B-A3B-4bit",
    thinking: false,
  },
  "40b": {
    model: "flint-40b-128k-cc",
    memory_gb: 27,
    mlx: "mlx-community/flint-oQ4e",
    thinking: true,
  },
};

const GIB = 1024 ** 3;
const SIXTEEN_GB = { memoryBytes: 16 * GIB, wiredLimitMb: 0 };
const NINE_B_MLX = "mlx-community--Qwen3.5-9B-4bit";

function claudeLiteCheckout(sizes: object = SIZES) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "claude-lite-")));
  mkdirSync(path.join(root, "dist"));
  mkdirSync(path.join(root, "config"));
  mkdirSync(path.join(root, "path-bin"));
  const launcher = path.join(root, "dist", "claude-lite");
  writeFileSync(launcher, "");
  symlinkSync(launcher, path.join(root, "path-bin", "cl"));
  writeFileSync(path.join(root, "config", "sizes.json"), JSON.stringify(sizes));
  return { home: root, binDir: path.join(root, "path-bin") };
}

type Servers = { omlx?: string[] | null; ollama?: string[] | null };

function servers({ omlx = null, ollama = null }: Servers, requests: string[] = []): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    requests.push(url);
    if (url === "http://127.0.0.1:8435/v1/models" && omlx) {
      return Response.json({ data: omlx.map((id) => ({ id })) });
    }
    if (url === "http://localhost:11434/api/tags" && ollama) {
      return Response.json({ models: ollama.map((name) => ({ name })) });
    }
    throw new Error("connection refused");
  }) as typeof fetch;
}

const SAVED = {
  enabled: true,
  model: null,
  thinking: "model",
  timeoutMs: 8000,
  backend: "local",
  claudeModel: "haiku",
} as const;

describe("chooseModel", () => {
  it("serves the largest fitting size from oMLX before Ollama when no URL is set", async () => {
    const { binDir } = claudeLiteCheckout();
    const choice = await chooseModel(
      { PATH: binDir },
      servers({ omlx: [NINE_B_MLX], ollama: ["qwen3.5-9b-mtp-cc"] }),
      null,
      SIXTEEN_GB,
    );
    expect(choice).toMatchObject({
      server: "omlx",
      baseURL: "http://127.0.0.1:8435",
      model: NINE_B_MLX,
      size: "9b",
      isUsable: true,
    });
  });

  it("never picks a size above the memory budget, even when it is served", async () => {
    const { binDir } = claudeLiteCheckout();
    const choice = await chooseModel(
      { PATH: binDir },
      servers({ omlx: [NINE_B_MLX, "mlx-community--Qwen3.6-35B-A3B-4bit"] }),
      null,
      SIXTEEN_GB,
    );
    expect(choice.size).toBe("9b");
    expect(choice.sizes).toContainEqual({
      name: "35b",
      memoryGb: 22,
      isFitting: false,
      isServed: true,
    });
  });

  it("picks the largest served size that fits a bigger machine", async () => {
    const { binDir } = claudeLiteCheckout();
    const choice = await chooseModel(
      { PATH: binDir },
      servers({ omlx: [NINE_B_MLX, "mlx-community--Qwen3.6-35B-A3B-4bit"] }),
      null,
      { memoryBytes: 64 * GIB, wiredLimitMb: 0 },
    );
    expect(choice.size).toBe("35b");
  });

  it("uses Ollama's installed size names when oMLX does not answer", async () => {
    const { binDir } = claudeLiteCheckout();
    const choice = await chooseModel(
      { PATH: binDir },
      servers({ ollama: ["qwen3.5-9b-mtp-cc:latest"] }),
      null,
      SIXTEEN_GB,
    );
    expect(choice).toMatchObject({ server: "ollama", model: "qwen3.5-9b-mtp-cc", size: "9b" });
  });

  it("uses the configured URL as Ollama and does not probe the oMLX port", async () => {
    const { binDir } = claudeLiteCheckout();
    const requests: string[] = [];
    const env = { PATH: binDir, REVIEW_QUEUE_LLM_URL: "http://localhost:11434" };
    const choice = await chooseModel(
      env,
      servers({ omlx: [NINE_B_MLX], ollama: ["qwen3.5-9b-mtp-cc"] }, requests),
      null,
      SIXTEEN_GB,
    );
    expect(choice.server).toBe("ollama");
    expect(requests).not.toContain("http://127.0.0.1:8435/v1/models");
  });

  it("names the command that starts a model when nothing is served", async () => {
    const { binDir } = claudeLiteCheckout();
    const choice = await chooseModel({ PATH: binDir }, servers({}), null, SIXTEEN_GB);
    expect(choice.isUsable).toBe(false);
    expect(choice.reason).toContain("`cl serve 9b`");
  });

  it("says that nothing fits when the machine is too small for every size", async () => {
    const { binDir } = claudeLiteCheckout();
    const choice = await chooseModel({ PATH: binDir }, servers({ omlx: [NINE_B_MLX] }), null, {
      memoryBytes: 8 * GIB,
      wiredLimitMb: 0,
    });
    expect(choice.isUsable).toBe(false);
    expect(choice.reason).toContain("9\u00a0GB");
  });

  it("finds claude-lite from CLAUDE_LITE_HOME without a cl on PATH", async () => {
    const { home } = claudeLiteCheckout();
    const choice = await chooseModel(
      { CLAUDE_LITE_HOME: home },
      servers({ omlx: [NINE_B_MLX] }),
      null,
      SIXTEEN_GB,
    );
    expect(choice.size).toBe("9b");
  });

  it("says where claude-lite was looked for when it is not found", async () => {
    const choice = await chooseModel(
      { PATH: "/nowhere" },
      servers({ omlx: [NINE_B_MLX] }),
      null,
      SIXTEEN_GB,
    );
    expect(choice.isUsable).toBe(false);
    expect(choice.reason).toContain("CLAUDE_LITE_HOME");
  });

  it("applies claude-lite's local-sizes overlay", async () => {
    const { binDir, home } = claudeLiteCheckout();
    writeFileSync(
      path.join(home, "config", "local-sizes.json"),
      JSON.stringify({ "9b": { memory_gb: 4 } }),
    );
    const choice = await chooseModel({ PATH: binDir }, servers({ omlx: [NINE_B_MLX] }), null, {
      memoryBytes: 8 * GIB,
      wiredLimitMb: 0,
    });
    expect(choice.size).toBe("9b");
  });

  it("keeps a model chosen by hand", async () => {
    const { binDir } = claudeLiteCheckout();
    const choice = await chooseModel({ PATH: binDir }, servers({ omlx: [] }), "mine", SIXTEEN_GB);
    expect(choice).toMatchObject({ model: "mine", size: null, isUsable: true });
  });

  it("has no memory limit for a remote server", async () => {
    const { binDir } = claudeLiteCheckout();
    const choice = await chooseModel(
      { PATH: binDir, REVIEW_QUEUE_LLM_URL: "http://gpu.example:11434" },
      (async () => Response.json({ models: [{ name: "qwen3.6-35b-cc" }] })) as typeof fetch,
      null,
      SIXTEEN_GB,
    );
    expect(choice).toMatchObject({ budgetGb: null, size: "35b", model: "qwen3.6-35b-cc" });
  });
});

describe("llmConfig", () => {
  it("follows the chosen size's thinking default unless settings say otherwise", async () => {
    const { binDir } = claudeLiteCheckout();
    const fetchImpl = servers({ omlx: [NINE_B_MLX] });
    const env = { PATH: binDir };
    expect((await llmConfig(env, fetchImpl, SAVED)).thinking).toBe(false);
    expect((await llmConfig(env, fetchImpl, { ...SAVED, thinking: "on" })).thinking).toBe(true);
    expect((await llmConfig(env, fetchImpl, { ...SAVED, thinking: "off" })).thinking).toBe(false);
  });

  it("lets the environment choose thinking when nothing is saved", async () => {
    const { binDir } = claudeLiteCheckout();
    const config = await llmConfig(
      { PATH: binDir, REVIEW_QUEUE_LLM_THINKING: "on" },
      servers({ omlx: [NINE_B_MLX] }),
    );
    expect(config.thinking).toBe(true);
  });

  it("returns the reason as a problem when no model can be used", async () => {
    const { binDir } = claudeLiteCheckout();
    const config = await llmConfig({ PATH: binDir }, servers({}), SAVED);
    expect(config.problem).toContain("`cl serve 9b`");
    expect(config.model).toBe("");
  });

  it("returns no problem when a model is chosen", async () => {
    const { binDir } = claudeLiteCheckout();
    const config = await llmConfig({ PATH: binDir }, servers({ omlx: [NINE_B_MLX] }), SAVED);
    expect(config).toMatchObject({
      model: NINE_B_MLX,
      baseURL: "http://127.0.0.1:8435",
      problem: null,
    });
  });

  it("uses Claude Code's model without asking any server", async () => {
    const config = await llmConfig(
      {},
      (async () => {
        throw new Error("no server must be asked");
      }) as typeof fetch,
      { ...SAVED, backend: "claude-code", claudeModel: "sonnet" },
    );
    expect(config).toMatchObject({ backend: "claude-code", model: "sonnet", problem: null });
  });
});
