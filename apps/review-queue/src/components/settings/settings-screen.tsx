"use client";

import { Bot, ChevronDown, Clock, Flag, GitPullRequest } from "lucide-react";
import { cn } from "cn";
import { useState, type FormEvent } from "react";
import { CacheZone } from "@/components/settings/cache-zone";
import { Otter } from "@/components/neon/otter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CARD_CLASS } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CLAUDE_MODELS,
  type ClaudeModel,
  type LlmBackend,
  type ThinkingSetting,
} from "@/lib/llm/backends";
import type { ModelChoice } from "@/lib/llm/model-choice";
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

const THINKING_OPTIONS: { value: ThinkingSetting; label: string }[] = [
  { value: "model", label: "Follow the model" },
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
];

function modelChoices(view: SettingsView, chosen: string | null): string[] {
  const served = view.choice.served ?? [];
  return chosen && !served.includes(chosen) ? [chosen, ...served] : served;
}

function ModelReason({ choice }: { choice: ModelChoice }) {
  const tooBig = choice.sizes.filter((size) => !size.isFitting);
  return (
    <span className="grid gap-1">
      <span>{choice.reason}</span>
      {tooBig.length > 0 && (
        <span>
          {`Does not fit this machine: ${tooBig.map((size) => `${size.name} (${size.memoryGb}\u00a0GB)`).join(", ")}.`}
        </span>
      )}
    </span>
  );
}

const SELECT_CLASS =
  "h-10 w-full min-w-0 appearance-none rounded-sm border border-line bg-bg px-3 pr-9 font-mono text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-ring";
const CHEVRON_CLASS =
  "pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-muted";

export function SettingsScreen({ initial }: { initial: SettingsView }) {
  const [view, setView] = useState(initial);
  const [settings, setSettings] = useState(initial.llm);
  const [seconds, setSeconds] = useState(String(initial.llm.timeoutMs / 1000));
  const [repositories, setRepositories] = useState(initial.repositories);
  const [isPrepareNextOn, setPrepareNextOn] = useState(initial.prepareNext);
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
    saveSettings({
      llm: { ...settings, timeoutMs: Number(seconds) * 1000 },
      repositories,
      prepareNext: isPrepareNextOn,
    })
      .then((next) => {
        setView(next);
        setSettings(next.llm);
        setRepositories(next.repositories);
        setPrepareNextOn(next.prepareNext);
        setStatus("Saved.");
      })
      .catch((failure: Error) => setStatus(failure.message));
  }

  const isClaudeCode = settings.backend === "claude-code";

  return (
    <form onSubmit={save} className="flex min-w-0 flex-col gap-4">
      <section aria-label="Model Settings" className={CARD_CLASS}>
        <PanelHeading icon={Bot} title="Model Settings" />
        <SettingRow
          label={
            <label htmlFor="enabled" className="font-medium">
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
            <span id="backend-label" className="font-medium">
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
                <p className="flex gap-2 rounded-sm bg-tint-amber p-3 text-label">
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
      </section>

      <section aria-label="Model Behavior" className={CARD_CLASS}>
        <PanelHeading icon={Clock} title="Model Behavior" />
        {isClaudeCode ? (
          <SettingRow
            label={
              <label htmlFor="claude-model" className="font-medium">
                Claude Model
              </label>
            }
            hint="Ask answers without looking up other files."
            control={
              <div className="relative w-full min-w-0 sm:w-64">
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
                <ChevronDown aria-hidden="true" className={CHEVRON_CLASS} />
              </div>
            }
          />
        ) : (
          <SettingRow
            label={
              <label htmlFor="model" className="font-medium">
                Model
              </label>
            }
            hint={<ModelReason choice={view.choice} />}
            control={
              <div className="relative w-full min-w-0 sm:w-64">
                <select
                  id="model"
                  value={settings.model ?? ""}
                  onChange={(event) => change({ model: event.target.value || null })}
                  className={SELECT_CLASS}
                >
                  <option value="">
                    {view.choice.model ? `Auto (${view.choice.model})` : "Auto"}
                  </option>
                  {modelChoices(view, settings.model).map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" className={CHEVRON_CLASS} />
              </div>
            }
          />
        )}
        <SettingRow
          label={
            <span id="thinking-label" className="font-medium">
              Thinking Before Answering
            </span>
          }
          hint="Follow the model uses the chosen size's default. Thinking adds up to 2048 tokens, which can take minutes on a small machine."
          control={
            <SegmentedPicker<ThinkingSetting>
              name="thinking"
              labelId="thinking-label"
              options={THINKING_OPTIONS}
              value={settings.thinking}
              onChange={(thinking) => change({ thinking })}
            />
          }
        />
        <SettingRow
          label={
            <label htmlFor="timeout" className="font-medium">
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
              className="w-32 font-mono"
            />
          }
        />
      </section>

      <section aria-label="Pull Requests" className={CARD_CLASS}>
        <PanelHeading icon={GitPullRequest} title="Pull Requests" />
        <div className="grid gap-2 border-t border-line-soft pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="repositories-input" className="font-medium">
              Repositories
            </label>
            <Badge variant="blue">
              {repositories.length} of {REPOSITORY_LIMIT}
            </Badge>
          </div>
          <p id="repositories-hint" className="text-label text-fg-muted">
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
        <SettingRow
          label={
            <label htmlFor="prepare-next" className="font-medium">
              Prepare the next PR while I&apos;m idle
            </label>
          }
          hint={
            "Off by default. When on, the Queue prepares its Up next PR once you have been idle for a while: the repository is cloned in the background and about 6\u00a0GB of model stays in memory."
          }
          control={
            <ToggleSwitch id="prepare-next" checked={isPrepareNextOn} onChange={setPrepareNextOn} />
          }
        />
      </section>

      <section aria-label="Clear the Cache" className={cn(CARD_CLASS, "border-ink-coral/50")}>
        <CacheZone />
      </section>

      <section
        aria-label="Save changes"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-soft bg-surface p-4 sm:p-6"
      >
        <p aria-live="polite" className="flex min-w-0 items-center gap-3">
          <Otter size="small" />
          <span className="grid min-w-0 gap-1">
            <span className="text-sm font-medium">
              {status ?? "Press save to keep your changes"}
            </span>
            <span className="text-label text-fg-muted">The otter is ready when you are.</span>
          </span>
        </p>
        <Button type="submit">Save settings</Button>
      </section>
    </form>
  );
}
