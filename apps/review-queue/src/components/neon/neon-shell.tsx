import type { ReactNode } from "react";
import { AppBar } from "./app-bar";

export function NeonShell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <AppBar />
      <div className="app-body">{children}</div>
    </div>
  );
}
