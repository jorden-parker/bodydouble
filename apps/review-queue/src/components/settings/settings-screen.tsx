"use client";

import { Bot, Check, ChevronDown, Clock, Flag, GitPullRequest } from "lucide-react";
import { useState, type FormEvent } from "react";
import { CacheZone } from "@/components/settings/cache-zone";
import { Otter } from "@/components/neon/otter";
import { Panel, Panels } from "@/components/neon/panels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CLAUDE_MODELS, type ClaudeModel, type LlmBackend } from "@/lib/llm/backends";
import type { LlmSettings } from "@/lib/settings/llm-settings";
import { REPOSITORY_LIMIT } from "@/lib/settings/repository-settings";
import type { SettingsView } from "@/lib/settings/settings-service";
import { saveSettings } from "./settings-api";
import {
  PanelHeading,
  SegmentedPicker,
  SettingRow,
  TokenInput,
  ToggleSwitch,
} from "./settings-fields";

const BACKEND_OPTIONS: { value: LlmBackend; label: string }[] = [
  { value: "local", label: "Local model" },
  { value: "claude-code", label: "Claude Code" },
];

const PANEL_CLASS =
  "min-w-72 self-stretch rounded-2xl border border-line bg-surface p-s-5 shadow-lift";
const DANGER_PANEL_CLASS =
  "min-w-72 self-start rounded-2xl border-[1.5px] border-ink-coral bg-[color-mix(in_oklch,var(--neon-coral)_6%,var(--surface))] p-s-5 shadow-lift";
const FRAME_CLASS = "mx-auto w-full max-w-[1680px] px-[clamp(var(--s-4),3vw,var(--s-7))]";

function modelChoices(view: SettingsView, chosen: string | null): string[] {
  return chosen && !view.models.includes(chosen) ? [chosen, ...view.models] : view.models;
}

const SELECT_CLASS =
  "min-h-12 w-full appearance-none rounded-md border-[1.5px] border-line bg-canvas px-s-4 pr-s-6 font-mono text-[0.95rem] text-fg";

export function SettingsScreen({ initial }: { initial: SettingsView }) {
  const [view, setView] = useState(initial);
  const [settings, setSettings] = useState(initial.llm);
  const [seconds, setSeconds] = useState(String(initial.llm.timeoutMs / 1000));
  const [repositories, setRepositories] = useState(initial.repositories);
  const [status, setStatus] = useState<string | null>(null);

  function change(patch: Partial<LlmSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function addRepositories(text: string) {
    const added = text.split(/[\s,]+/).filter((entry) => entry.length > 0);
    setRepositories((current) => [...new Set([...current, ...added])]);
  }

  function removeRepository(value: string) {
    setRepositories((current) => current.filter((entry) => entry !== value));
  }

  function save(event: FormEvent) {
    event.preventDefault();
    setStatus(null);
    saveSettings({ llm: { ...settings, timeoutMs: Number(seconds) * 1000 }, repositories })
      .then((next) => {
        setView(next);
        setSettings(next.llm);
        setRepositories(next.repositories);
        setStatus("Saved.");
      })
      .catch((failure: Error) => setStatus(failure.message));
  }

  const isClaudeCode = settings.backend === "claude-code";

  return (
    <form
      onSubmit={save}
      className="flex min-h-0 flex-1 flex-col [&_.app-main]:grid-rows-[auto_minmax(0,1fr)]"
    >
      <Panels label="Settings sections">
        <Panel
          title="Model Settings"
          className={`${PANEL_CLASS} col-start-1 row-span-2 row-start-1`}
        >
          <PanelHeading icon={Bot} title="Model Settings" />
          <SettingRow
            label={
              <label htmlFor="enabled" className="font-bold">
                Use the Model
              </label>
            }
            hint="Orientation, step explanations, summary drafts and Ask."
            control={
              <ToggleSwitch
                id="enabled"
                checked={settings.enabled}
                onChange={(enabled) => change({ enabled })}
              />
            }
          />
          <SettingRow
            label={
              <span id="backend-label" className="font-bold">
                Model Backend
              </span>
            }
            hint="Where the model runs for this review."
            control={
              <>
                <SegmentedPicker<LlmBackend>
                  name="backend"
                  labelId="backend-label"
                  options={BACKEND_OPTIONS}
                  value={settings.backend}
                  onChange={(backend) => change({ backend })}
                />
                {isClaudeCode && (
                  <p className="flex gap-s-2 rounded-md bg-tint-amber p-s-3 text-sm">
                    <Flag aria-hidden="true" className="mt-0.5 size-4 flex-none text-ink-amber" />
                    <span>
                      Claude Code runs your logged-in <code className="font-mono">claude</code>{" "}
                      command, so PR code is sent to Anthropic.
                    </span>
                  </p>
                )}
              </>
            }
          />
        </Panel>

        <Panel
          title="Model Behavior"
          className={`${PANEL_CLASS} col-start-2 row-span-2 row-start-1`}
        >
          <PanelHeading icon={Clock} title="Model Behavior" />
          {isClaudeCode ? (
            <SettingRow
              label={
                <label htmlFor="claude-model" className="font-bold">
                  Claude Model
                </label>
              }
              hint="Ask answers without looking up other files."
              control={
                <div className="relative w-64 max-w-full">
                  <select
                    id="claude-model"
                    value={settings.claudeModel}
                    onChange={(event) => change({ claudeModel: event.target.value as ClaudeModel })}
                    className={SELECT_CLASS}
                  >
                    {CLAUDE_MODELS.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 right-s-4 size-4 -translate-y-1/2 text-fg-muted"
                  />
                </div>
              }
            />
          ) : (
            <SettingRow
              label={
                <label htmlFor="model" className="font-bold">
                  Model
                </label>
              }
              hint="Auto uses the first suitable installed model."
              control={
                <div className="relative w-64 max-w-full">
                  <select
                    id="model"
                    value={settings.model ?? ""}
                    onChange={(event) => change({ model: event.target.value || null })}
                    className={SELECT_CLASS}
                  >
                    <option value="">{view.autoModel ? `Auto (${view.autoModel})` : "Auto"}</option>
                    {modelChoices(view, settings.model).map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 right-s-4 size-4 -translate-y-1/2 text-fg-muted"
                  />
                </div>
              }
            />
          )}
          <SettingRow
            label={
              <label htmlFor="thinking" className="font-bold">
                Let the Model Think Before Answering
              </label>
            }
            hint="Turn off only for models that answer directly. Qwen models repeat themselves without it."
            control={
              <ToggleSwitch
                id="thinking"
                checked={settings.thinking}
                onChange={(thinking) => change({ thinking })}
              />
            }
          />
          <SettingRow
            label={
              <label htmlFor="timeout" className="font-bold">
                Timeout (Seconds)
              </label>
            }
            hint="How long to wait for the model to start answering, up to 3600. Raise it on a slow machine or when reviewing whole files; once the answer starts it is never cut off."
            control={
              <Input
                id="timeout"
                type="number"
                min={1}
                max={3600}
                inputMode="numeric"
                value={seconds}
                onChange={(event) => setSeconds(event.target.value)}
                className="h-12 w-32 font-mono"
              />
            }
          />
        </Panel>

        <Panel title="Pull Requests" className={`${PANEL_CLASS} col-start-3 row-start-1`}>
          <PanelHeading icon={GitPullRequest} title="Pull Requests" />
          <div className="grid gap-s-2 border-t border-line-soft py-s-3">
            <div className="flex flex-wrap items-center gap-s-2">
              <label htmlFor="repositories-input" className="font-bold">
                Repositories
              </label>
              <Badge variant="blue">
                {repositories.length} of {REPOSITORY_LIMIT}
              </Badge>
            </div>
            <p id="repositories-hint" className="text-sm text-fg-muted">
              One owner/repo each. Their open pull requests show on the home page.
            </p>
            <TokenInput
              id="repositories-input"
              describedBy="repositories-hint"
              values={repositories}
              onAdd={addRepositories}
              onRemove={removeRepository}
            />
          </div>
        </Panel>

        <Panel title="Clear the Cache" className={`${DANGER_PANEL_CLASS} col-start-3 row-start-2`}>
          <CacheZone />
        </Panel>
      </Panels>

      <div className={`${FRAME_CLASS} pb-s-4 pt-s-4`}>
        <div
          role="region"
          aria-label="Save changes"
          className="flex flex-wrap items-center gap-s-3 rounded-pill border border-line bg-surface py-s-2 pr-s-2 pl-s-4 shadow-lift"
        >
          <span
            aria-hidden="true"
            className="size-2.5 flex-none rounded-full bg-neon-amber shadow-[0_0_0_4px_var(--tint-amber)]"
          />
          <p aria-live="polite" className="grid min-w-0">
            <strong className="font-bold">{status ?? "Press save to keep your changes"}</strong>
            <span className="text-sm text-fg-muted">The otter is ready when you are.</span>
          </p>
          <Otter size="medium" className="max-md:hidden" />
          <Button type="submit" variant="neon" className="ml-auto">
            <Check aria-hidden="true" />
            Save settings
          </Button>
        </div>
      </div>
    </form>
  );
}
