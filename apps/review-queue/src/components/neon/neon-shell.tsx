"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "cn";
import { AppBar } from "./app-bar";

const WORKSPACE_PATH_PREFIX = "/pr/";

export function NeonShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isWorkspace = pathname.startsWith(WORKSPACE_PATH_PREFIX);
  return (
    <div className={cn("app", isWorkspace && "app--workspace")}>
      <AppBar />
      <div className="app-body">{children}</div>
    </div>
  );
}
