"use client";

import { X, Plus, type LucideIcon } from "lucide-react";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "cn";

export function PanelHeading({
  icon: Icon,
  title,
  isDanger = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  isDanger?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-s-3">
      <span
        aria-hidden="true"
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-md",
          isDanger ? "bg-tint-coral text-ink-coral" : "bg-tint-blue text-ink-blue",
        )}
      >
        <Icon className="size-[22px]" />
      </span>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {children}
    </div>
  );
}

export function SettingRow({
  label,
  hint,
  control,
}: {
  label: ReactNode;
  hint: string;
  control: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-s-4 gap-y-s-2 border-t border-line-soft py-s-3">
      <div className="grid min-w-0 flex-1 basis-44 gap-0.5">
        {label}
        <p className="text-sm text-fg-muted">{hint}</p>
      </div>
      <div className="grid max-w-full flex-none items-start justify-items-start gap-s-2">
        {control}
      </div>
    </div>
  );
}

export function ToggleSwitch({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      id={id}
      type="checkbox"
      role="switch"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="relative m-0 h-11 w-14 shrink-0 cursor-pointer appearance-none rounded-pill transition-colors before:absolute before:top-1/2 before:left-1/2 before:h-7 before:w-13 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-pill before:border before:border-line before:bg-surface-3 before:transition-colors checked:before:border-transparent checked:before:bg-neon after:absolute after:top-1/2 after:left-[calc(50%-23px)] after:size-[22px] after:-translate-y-1/2 after:rounded-full after:bg-fg-muted after:transition-transform checked:after:translate-x-6 checked:after:bg-background focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-neon-amber"
    />
  );
}

export function SegmentedPicker<Value extends string>({
  name,
  labelId,
  options,
  value,
  onChange,
}: {
  name: string;
  labelId: string;
  options: { value: Value; label: string }[];
  value: Value;
  onChange: (value: Value) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className="inline-flex max-w-full flex-nowrap gap-s-1 rounded-pill border border-line bg-canvas p-s-1"
    >
      {options.map((option) => (
        <label
          key={option.value}
          className="relative inline-flex min-h-11 cursor-pointer items-center whitespace-nowrap rounded-pill px-s-4 font-bold text-fg-muted hover:text-fg has-[:checked]:bg-tint-blue has-[:checked]:text-fg has-[:checked]:shadow-[inset_0_0_0_1.5px_var(--neon-blue)] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-neon-amber"
        >
          <input
            type="radio"
            name={name}
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

export function TokenInput({
  id,
  describedBy,
  values,
  onAdd,
  onRemove,
}: {
  id: string;
  describedBy: string;
  values: string[];
  onAdd: (text: string) => void;
  onRemove: (value: string) => void;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    if (draft.trim().length > 0) onAdd(draft);
    setDraft("");
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commit();
  }

  return (
    <ul
      aria-label="Chosen repositories"
      className="flex w-full flex-wrap items-center gap-s-2 rounded-md border-[1.5px] border-line bg-canvas p-s-2 focus-within:border-neon-blue focus-within:ring-4 focus-within:ring-tint-blue"
    >
      {values.map((value) => (
        <li
          key={value}
          className="inline-flex min-h-11 items-center rounded-pill border border-ink-blue/45 bg-tint-blue pl-s-3 font-mono text-sm font-semibold"
        >
          {value}
          <button
            type="button"
            aria-label={`Remove ${value}`}
            onClick={() => onRemove(value)}
            className="grid size-11 place-items-center rounded-full text-fg-muted hover:bg-surface-3 hover:text-fg"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </li>
      ))}
      <li className="flex min-w-0 flex-1 basis-36 items-center gap-s-1">
        <input
          id={id}
          type="text"
          placeholder="owner/repo"
          autoComplete="off"
          aria-describedby={describedBy}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKey}
          className="min-h-11 min-w-0 flex-1 bg-transparent px-s-2 font-mono text-sm text-fg outline-none placeholder:text-fg-faint"
        />
        <button
          type="button"
          aria-label="Add repository"
          onClick={commit}
          className="grid size-11 flex-none place-items-center rounded-full bg-surface-2 text-ink-blue hover:bg-surface-3"
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </li>
    </ul>
  );
}
