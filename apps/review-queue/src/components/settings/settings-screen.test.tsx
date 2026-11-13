import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SettingsView } from "@/lib/settings/settings-service";
import { SettingsScreen } from "./settings-screen";

const VIEW: SettingsView = {
  llm: {
    enabled: true,
    model: null,
    thinking: true,
    timeoutMs: 8000,
    backend: "local",
    claudeModel: "haiku",
  },
  models: ["qwen3-4b-cc", "granite4.2-3b-cc"],
  autoModel: "granite4.2-3b-cc",
  repositories: [],
};

type Call = { url: string; method: string; body: unknown };

function fakeFetch(answers: Record<string, unknown>) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push({ url, method, body: init.body ? JSON.parse(String(init.body)) : null });
    return Response.json(answers[`${method} ${url}`]);
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("SettingsScreen", () => {
  it("groups the settings into named panels", () => {
    render(<SettingsScreen initial={VIEW} />);
    for (const title of ["Model Settings", "Model Behavior", "Pull Requests", "Clear the Cache"]) {
      expect(screen.getByRole("region", { name: title })).toBeTruthy();
    }
  });

  it("sizes the cache panel to its content so its button stays inside the card", () => {
    render(<SettingsScreen initial={VIEW} />);
    expect(
      screen.getByRole("region", { name: "Clear the Cache" }).classList.contains("self-start"),
    ).toBe(true);
  });

  it("keeps the backend options side by side on one line", () => {
    render(<SettingsScreen initial={VIEW} />);
    expect(screen.getByRole("radiogroup").classList.contains("flex-nowrap")).toBe(true);
    for (const option of ["Local model", "Claude Code"]) {
      const label = screen.getByRole("radio", { name: option }).closest("label");
      expect(label?.classList.contains("whitespace-nowrap")).toBe(true);
    }
  });

  it("keeps the save button in one save bar outside the panels", () => {
    render(<SettingsScreen initial={VIEW} />);
    const saveBar = screen.getByRole("region", { name: "Save changes" });
    expect(within(saveBar).getByRole("button", { name: "Save settings" })).toBeTruthy();
  });

  it("offers auto, naming the model it picks, and every installed model", () => {
    render(<SettingsScreen initial={VIEW} />);
    const options = within(screen.getByLabelText("Model"))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual(["Auto (granite4.2-3b-cc)", "qwen3-4b-cc", "granite4.2-3b-cc"]);
  });

  it("shows the local backend by default, with the local model field and no Claude one", () => {
    render(<SettingsScreen initial={VIEW} />);
    expect(screen.getByRole("radio", { name: "Local model" })).toHaveProperty("checked", true);
    expect(screen.queryByLabelText("Claude model")).toBeNull();
    expect(screen.queryByText(/sent to Anthropic/)).toBeNull();
  });

  it("swaps the local model field for a Claude model choice, and says code goes to Anthropic", async () => {
    render(<SettingsScreen initial={VIEW} />);
    await userEvent.click(screen.getByRole("radio", { name: "Claude Code" }));
    expect(screen.queryByLabelText("Model")).toBeNull();
    const choices = within(screen.getByLabelText("Claude Model"))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(choices).toEqual(["haiku", "sonnet", "opus"]);
    expect(screen.getByText(/sent to Anthropic/)).toBeTruthy();
  });

  it("saves every change in one request: model, thinking, timeout and repositories", async () => {
    const saved = { ...VIEW.llm, model: "qwen3-4b-cc", thinking: false, timeoutMs: 30_000 };
    const calls = fakeFetch({
      "PUT /api/settings": { ...VIEW, llm: saved, repositories: ["acme/api"] },
    });
    render(<SettingsScreen initial={VIEW} />);
    await userEvent.selectOptions(screen.getByLabelText("Model"), "qwen3-4b-cc");
    await userEvent.click(screen.getByRole("switch", { name: /Let the Model Think/ }));
    await userEvent.clear(screen.getByLabelText("Timeout (Seconds)"));
    await userEvent.type(screen.getByLabelText("Timeout (Seconds)"), "30");
    await userEvent.type(screen.getByLabelText("Repositories"), "acme/api{enter}");
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText("Saved.")).toBeTruthy();
    expect(calls).toEqual([
      {
        url: "/api/settings",
        method: "PUT",
        body: { llm: saved, repositories: ["acme/api"] },
      },
    ]);
  });

  it("saves Claude Code with the chosen Claude model", async () => {
    const saved = { ...VIEW.llm, backend: "claude-code", claudeModel: "sonnet" };
    const calls = fakeFetch({ "PUT /api/settings": { ...VIEW, llm: saved } });
    render(<SettingsScreen initial={VIEW} />);
    await userEvent.click(screen.getByRole("radio", { name: "Claude Code" }));
    await userEvent.selectOptions(screen.getByLabelText("Claude Model"), "sonnet");
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText("Saved.")).toBeTruthy();
    expect(calls).toEqual([
      { url: "/api/settings", method: "PUT", body: { llm: saved, repositories: [] } },
    ]);
  });

  it("adds repositories as chips, several at once, and drops duplicates", async () => {
    render(<SettingsScreen initial={VIEW} />);
    await userEvent.type(screen.getByLabelText("Repositories"), "acme/api, acme/web{enter}");
    await userEvent.type(screen.getByLabelText("Repositories"), "acme/api{enter}");
    const chosen = screen.getByRole("list", { name: "Chosen repositories" });
    expect(within(chosen).getByText("acme/api")).toBeTruthy();
    expect(within(chosen).getByText("acme/web")).toBeTruthy();
    expect(within(chosen).getAllByText("acme/api")).toHaveLength(1);
    expect(screen.getByText("2 of 20")).toBeTruthy();
  });

  it("removes a repository chip", async () => {
    render(<SettingsScreen initial={{ ...VIEW, repositories: ["acme/api", "acme/web"] }} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove acme/api" }));
    expect(screen.queryByText("acme/api")).toBeNull();
    expect(screen.getByText("acme/web")).toBeTruthy();
  });

  it("clears cached answers and says how many went", async () => {
    const calls = fakeFetch({ "DELETE /api/settings/cache": { cleared: 3 } });
    render(<SettingsScreen initial={VIEW} />);
    await userEvent.click(screen.getByRole("button", { name: "Clear cache" }));
    expect(await screen.findByText("Cleared 3 cached entries.")).toBeTruthy();
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "DELETE /api/settings/cache",
    ]);
  });

  it("shows why saving failed", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ error: "Too small: expected number to be >=1000" }, { status: 400 }),
    );
    render(<SettingsScreen initial={VIEW} />);
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText(/Too small/)).toBeTruthy();
  });
});
