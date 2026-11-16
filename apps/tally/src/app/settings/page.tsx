import type { Metadata } from "next";
import { SettingsForm } from "@/components/settings/settings-form";

export const metadata: Metadata = { title: "Settings · Tally" };

export default function SettingsPage() {
  return (
    <main id="main" className="app-main app-main--narrow">
      <header className="flex flex-col gap-2">
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Choose what Tally counts and how it reads your week.
        </p>
      </header>
      <SettingsForm />
    </main>
  );
}
