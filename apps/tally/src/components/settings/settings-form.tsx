"use client";

import {
  useEffect,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  CalendarIcon,
  CheckIcon,
  GitBranchIcon,
  PlusIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";
import { LoadingNote, ProblemAlert } from "@/components/layout/page-shell";
import { Panel, Panels } from "@/components/neon/panels";
import { TallyMark } from "@/components/neon/tally-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WeekStart } from "@/lib/metrics/buckets";
import type { Settings } from "@/lib/store/settings";
import { api as realApi, messageOf, type TallyApi } from "../api";

type SettingsFormProps = { api?: TallyApi };

type Fields = { allowList: string[]; weekStart: string; timeZone: string };

const TIME_ZONES = Intl.supportedValuesOf("timeZone");
const WEEK_STARTS: { value: string; label: string }[] = [
  { value: "1", label: "Monday" },
  { value: "0", label: "Sunday" },
];
const CHIP_CLASS =
  "inline-flex min-h-11 items-center gap-1 rounded-pill bg-tint-pink py-0 pr-1 pl-3 text-sm font-semibold text-ink-pink";

function toFields(view: Settings): Fields {
  return {
    allowList: [...view.allowList],
    weekStart: String(view.weekStart),
    timeZone: view.timeZone,
  };
}

function addSources(current: string[], incoming: string[]): string[] {
  const cleaned = incoming.map((source) => source.trim()).filter((source) => source !== "");
  return [...new Set([...current, ...cleaned])];
}

function saveStatus(isDirty: boolean, isSaved: boolean): string {
  if (isDirty) return "Unsaved changes. Tally is counting on your new settings.";
  return isSaved ? "Saved. Sync from the dashboard to pull in new repos." : "";
}

function WeekStartChoice({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby="week-start-label"
      aria-describedby="week-start-hint"
      className="inline-flex gap-1 rounded-pill border border-line bg-background p-1"
    >
      {WEEK_STARTS.map((option) => (
        <label
          key={option.value}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-pill px-4 text-sm font-bold text-muted-foreground has-[:checked]:bg-tint-blue has-[:checked]:text-ink-blue has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
        >
          <input
            type="radio"
            name="week-start"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

function SourcesContent({
  allowList,
  onAdd,
  onRemove,
}: {
  allowList: string[];
  onAdd: (sources: string[]) => void;
  onRemove: (source: string) => void;
}) {
  const [draft, setDraft] = useState("");

  function addDraft() {
    onAdd([draft]);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addDraft();
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    if (!text.includes("\n")) return;
    event.preventDefault();
    onAdd(text.split("\n"));
  }

  return (
    <>
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
        <GitBranchIcon aria-hidden="true" className="size-5 text-ink-pink" />
        Sources
      </h2>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor="allow-list" className="text-base font-semibold">
            GitHub Orgs and Repos
          </Label>
          <Badge variant="pink">{allowList.length} chosen</Badge>
        </div>
        <p id="allow-list-hint" className="text-sm text-muted-foreground">
          An owner (acme) or a single repo (acme/api). Tally counts PRs you review or open in these.
        </p>
        <ul aria-label="Chosen orgs and repos" className="flex flex-wrap gap-2">
          {allowList.map((source) => (
            <li key={source} className={CHIP_CLASS}>
              {source}
              <button
                type="button"
                aria-label={`Remove ${source}`}
                onClick={() => onRemove(source)}
                className="grid size-11 place-items-center rounded-pill outline-none hover:bg-tint-pink focus-visible:ring-2 focus-visible:ring-ring"
              >
                <XIcon aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            id="allow-list"
            aria-describedby="allow-list-hint"
            placeholder="owner or owner/repo"
            autoComplete="off"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
          />
          <Button
            variant="soft"
            size="icon"
            aria-label="Add org or repo"
            onClick={addDraft}
            className="shrink-0"
          >
            <PlusIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <RefreshCwIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        Saved changes need a sync from the dashboard to pull in new repos.
      </p>
    </>
  );
}

function CalendarContent({
  weekStart,
  timeZone,
  onWeekStartChange,
  onTimeZoneChange,
}: {
  weekStart: string;
  timeZone: string;
  onWeekStartChange: (value: string) => void;
  onTimeZoneChange: (value: string) => void;
}) {
  return (
    <>
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
        <CalendarIcon aria-hidden="true" className="size-5 text-ink-amber" />
        Calendar
      </h2>
      <div className="flex flex-col gap-3">
        <p id="week-start-label" className="font-display text-base font-semibold">
          Week Starts On
        </p>
        <p id="week-start-hint" className="text-sm text-muted-foreground">
          Your weekly counts begin on this day.
        </p>
        <WeekStartChoice value={weekStart} onChange={onWeekStartChange} />
      </div>
      <div className="flex flex-col gap-3">
        <Label htmlFor="time-zone" className="font-display text-base font-semibold">
          Time Zone
        </Label>
        <p id="time-zone-hint" className="text-sm text-muted-foreground">
          Decides which day a review or ticket counts toward.
        </p>
        <Input
          id="time-zone"
          name="timeZone"
          list="time-zones"
          autoComplete="off"
          spellCheck={false}
          aria-describedby="time-zone-hint"
          value={timeZone}
          onChange={(event) => onTimeZoneChange(event.target.value)}
        />
        <datalist id="time-zones">
          {TIME_ZONES.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
      </div>
    </>
  );
}

function CountedContent({
  allowList,
  weekStartName,
  timeZone,
}: {
  allowList: string[];
  weekStartName: string;
  timeZone: string;
}) {
  return (
    <>
      <div className="flex items-center gap-3">
        <TallyMark size="small" />
        <h2 className="font-display text-xl font-semibold">What Tally Counts</h2>
      </div>
      <p className="text-muted-foreground">Pull requests you review or open in these sources:</p>
      {allowList.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Tally counts nothing until you add a source.
        </p>
      ) : (
        <ul aria-label="Counted sources" className="flex flex-wrap gap-2">
          {allowList.map((source) => (
            <li key={source}>
              <Badge variant="pink">{source}</Badge>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex flex-wrap gap-2">
        <Badge variant="amber">Weeks start {weekStartName}</Badge>
        <Badge variant="neutral">{timeZone}</Badge>
      </div>
    </>
  );
}

function SaveBar({ isDirty, isSaved }: { isDirty: boolean; isSaved: boolean }) {
  return (
    <div
      role="region"
      aria-label="Save changes"
      className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface-2 px-5 py-4"
    >
      <span
        aria-hidden="true"
        className={`size-3 rounded-full ${isDirty ? "bg-neon-amber shadow-glow-amber" : "bg-faint"}`}
      />
      <p aria-live="polite" className="flex-1 text-sm text-muted-foreground">
        {saveStatus(isDirty, isSaved)}
      </p>
      <Button type="submit">
        <CheckIcon aria-hidden="true" />
        Save settings
      </Button>
    </div>
  );
}

export function SettingsForm({ api = realApi }: SettingsFormProps) {
  const [baseline, setBaseline] = useState<Fields | null>(null);
  const [fields, setFields] = useState<Fields | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    api
      .fetchSettings()
      .then((view) => {
        setBaseline(toFields(view));
        setFields(toFields(view));
      })
      .catch((failure) => setError(messageOf(failure)));
  }, [api]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!fields) return;
    setError(null);
    setIsSaved(false);
    try {
      const view = await api.saveSettings({
        allowList: fields.allowList,
        weekStart: Number(fields.weekStart) as WeekStart,
        timeZone: fields.timeZone,
      });
      setBaseline(toFields(view));
      setFields(toFields(view));
      setIsSaved(true);
    } catch (failure) {
      setError(messageOf(failure));
    }
  }

  function updateFields(update: (current: Fields) => Fields) {
    setFields((current) => (current ? update(current) : current));
  }

  function changeField(field: Exclude<keyof Fields, "allowList">, value: string) {
    updateFields((current) => ({ ...current, [field]: value }));
  }

  function addToAllowList(sources: string[]) {
    updateFields((current) => ({
      ...current,
      allowList: addSources(current.allowList, sources),
    }));
  }

  function removeSource(source: string) {
    updateFields((current) => ({
      ...current,
      allowList: current.allowList.filter((item) => item !== source),
    }));
  }

  const isDirty =
    fields !== null && baseline !== null && JSON.stringify(fields) !== JSON.stringify(baseline);
  const weekStartName =
    WEEK_STARTS.find((option) => option.value === fields?.weekStart)?.label ?? "";

  return (
    <>
      <ProblemAlert messages={error === null ? [] : [error]} />
      {fields === null && error === null ? <LoadingNote /> : null}
      {fields ? (
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col gap-4">
          <Panels className="min-h-0">
            <Panel title="Sources" className="min-h-0 min-w-72!">
              <SourcesContent
                allowList={fields.allowList}
                onAdd={addToAllowList}
                onRemove={removeSource}
              />
            </Panel>
            <Panel title="Calendar" className="min-h-0 min-w-72!">
              <CalendarContent
                weekStart={fields.weekStart}
                timeZone={fields.timeZone}
                onWeekStartChange={(value) => changeField("weekStart", value)}
                onTimeZoneChange={(value) => changeField("timeZone", value)}
              />
            </Panel>
            <Panel title="What Tally Counts" className="min-h-0 min-w-72!">
              <CountedContent
                allowList={fields.allowList}
                weekStartName={weekStartName}
                timeZone={fields.timeZone}
              />
            </Panel>
          </Panels>
          <SaveBar isDirty={isDirty} isSaved={isSaved} />
        </form>
      ) : null}
    </>
  );
}
