import { SettingsForm } from "@/components/settings/settings-form";

export default function SettingsPage() {
  return (
    <main className="app-main">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Choose what Tally counts and how it reads your week.
        </p>
      </header>
      <SettingsForm />
    </main>
  );
}
