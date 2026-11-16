"use client";

import { X, Plus, type LucideIcon } from "lucide-react";
import { useState, type KeyboardEvent, type ReactNode } from "react";

export function PanelHeading({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <Icon aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
      <h2 className="text-heading">{title}</h2>
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
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line-soft pt-4">
      <div className="grid min-w-0 flex-1 basis-56 gap-1">
        {label}
        <p className="text-label text-fg-muted">{hint}</p>
      </div>
      <div className="grid max-w-full min-w-0 flex-none items-start justify-items-start gap-2">
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
      className="relative m-0 h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-pill border border-line bg-bg transition-colors before:absolute before:top-0.5 before:left-0.5 before:size-4 before:rounded-pill before:bg-fg-muted before:transition-transform checked:border-primary checked:bg-primary checked:before:translate-x-5 checked:before:bg-primary-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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
      className="inline-flex max-w-full flex-nowrap gap-1 overflow-x-auto rounded-sm border border-line bg-bg p-1"
    >
      {options.map((option) => (
        <label
          key={option.value}
          className="inline-flex min-h-8 cursor-pointer items-center whitespace-nowrap rounded-sm px-3 text-label font-medium text-fg-muted transition-colors hover:text-fg has-[:checked]:bg-surface-2 has-[:checked]:text-fg has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
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
      className="flex w-full min-w-0 flex-wrap items-center gap-2 rounded-sm border border-line bg-bg p-2 focus-within:ring-2 focus-within:ring-ring"
    >
      {values.map((value) => (
        <li
          key={value}
          className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-sm border border-line-soft bg-surface-2 pl-2 font-mono text-label"
        >
          <span className="min-w-0 wrap-anywhere">{value}</span>
          <button
            type="button"
            aria-label={`Remove ${value}`}
            onClick={() => onRemove(value)}
            className="control-target grid size-7 shrink-0 place-items-center rounded-sm text-fg-muted hover:bg-surface-3 hover:text-fg"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        </li>
      ))}
      <li className="flex min-w-0 flex-1 basis-36 items-center gap-1">
        <input
          id={id}
          type="text"
          name="repository"
          placeholder="owner/repo"
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
          aria-describedby={describedBy}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKey}
          className="min-h-8 min-w-0 flex-1 bg-transparent px-2 font-mono text-sm text-fg placeholder:text-fg-faint outline-none"
        />
        <button
          type="button"
          aria-label="Add repository"
          onClick={commit}
          className="control-target grid size-7 flex-none place-items-center rounded-sm border border-line bg-surface text-fg hover:bg-surface-2"
        >
          <Plus aria-hidden="true" className="size-3.5" />
        </button>
      </li>
    </ul>
  );
}
