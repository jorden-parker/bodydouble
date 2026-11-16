import type { Metadata } from "next";
import { SettingsForm } from "@/components/settings/settings-form";
import { PageBand } from "@/components/layout/page-shell";

export const metadata: Metadata = { title: "Settings · Tally" };

export default function SettingsPage() {
  return (
    <>
      <PageBand narrow>
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="page-title">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Choose what Tally counts and how it reads your week.
          </p>
        </div>
      </PageBand>
      <main id="main" className="app-main app-main--narrow">
        <SettingsForm />
      </main>
    </>
  );
}
