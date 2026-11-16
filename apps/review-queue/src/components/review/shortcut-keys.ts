export type ShortcutAction =
  | "next-hunk"
  | "previous-hunk"
  | "next-step"
  | "previous-step"
  | "done-and-next"
  | "peek-definition"
  | "peek-references"
  | "pin-symbol"
  | "open-context"
  | "open-outline"
  | "open-files"
  | "open-map"
  | "open-hotspots"
  | "open-github"
  | "back"
  | "note"
  | "ask-model"
  | "park"
  | "toggle-all"
  | "toggle-panel"
  | "toggle-left-panel"
  | "toggle-right-panel"
  | "pause"
  | "close"
  | "help";

export type ShortcutRow = { keys: string[]; label: string; action?: ShortcutAction };

export const SHORTCUT_ROWS: ShortcutRow[] = [
  { keys: ["j"], label: "Next chunk", action: "next-hunk" },
  { keys: ["k"], label: "Previous chunk", action: "previous-hunk" },
  { keys: ["n"], label: "Next step", action: "next-step" },
  { keys: ["p"], label: "Previous step", action: "previous-step" },
  { keys: ["x"], label: "Mark step done and move on", action: "done-and-next" },
  { keys: ["g", "d"], label: "Definition of the hovered name", action: "peek-definition" },
  { keys: ["g", "r"], label: "References to the hovered name", action: "peek-references" },
  { keys: ["m"], label: "Pin or unpin the peeked name", action: "pin-symbol" },
  { keys: ["g", "c"], label: "Context: names you have peeked", action: "open-context" },
  { keys: ["g", "o"], label: "Context: outline of this step's files", action: "open-outline" },
  { keys: ["g", "f"], label: "Context: every file in this PR's head", action: "open-files" },
  { keys: ["g", "m"], label: "Context: how the changes fit together", action: "open-map" },
  { keys: ["g", "h"], label: "Hotspots in this step, in the path", action: "open-hotspots" },
  { keys: ["g", "g"], label: "Context: the PR's comments and your posts", action: "open-github" },
  { keys: ["b"], label: "Back from a jump", action: "back" },
  { keys: ["c"], label: "Note on the current chunk", action: "note" },
  { keys: ["i"], label: "Explain the selected lines", action: "ask-model" },
  { keys: ["P"], label: "Park a thought for later", action: "park" },
  { keys: ["a"], label: "Show the whole PR or just this step", action: "toggle-all" },
  { keys: ["["], label: "Hide or show the path", action: "toggle-left-panel" },
  { keys: ["]"], label: "Hide or show the companion", action: "toggle-right-panel" },
  { keys: ["\\"], label: "Hide or show both", action: "toggle-panel" },
  { keys: ["⌘ or Ctrl", "K"], label: "Command palette: files, outline, steps" },
  { keys: ["Shift", "click"], label: "Split a panel icon into its own pane (or drag it)" },
  { keys: ["."], label: "Pause and leave yourself a note", action: "pause" },
  { keys: ["Escape"], label: "Close panels", action: "close" },
  { keys: ["?"], label: "This help", action: "help" },
];

const SINGLE_KEYS: Record<string, ShortcutAction> = {};
const CHORDS: Record<string, Record<string, ShortcutAction>> = {};
for (const row of SHORTCUT_ROWS) {
  if (!row.action) continue;
  if (row.keys.length === 1) SINGLE_KEYS[row.keys[0]] = row.action;
  else if (row.keys.length === 2) (CHORDS[row.keys[0]] ??= {})[row.keys[1]] = row.action;
}

export function resolveShortcut(
  previousKey: string | null,
  key: string,
): ShortcutAction | "pending" | null {
  if (previousKey && CHORDS[previousKey]) return CHORDS[previousKey][key] ?? null;
  if (CHORDS[key]) return "pending";
  return SINGLE_KEYS[key] ?? null;
}
