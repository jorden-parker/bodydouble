"use client";

import { AppDialog } from "@/components/common/app-dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { SHORTCUT_ROWS } from "./shortcut-keys";

export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return (
    <AppDialog title="Keyboard" onClose={onClose} wide>
      <dl className="grid grid-cols-keys items-center gap-x-4 gap-y-2 text-sm">
        {SHORTCUT_ROWS.map((row) => (
          <div key={row.label} className="contents">
            <dt>
              <KbdGroup>
                {row.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </KbdGroup>
            </dt>
            <dd className="text-pretty text-muted-foreground">{row.label}</dd>
          </div>
        ))}
      </dl>
    </AppDialog>
  );
}
