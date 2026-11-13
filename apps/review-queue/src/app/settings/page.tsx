import { connection } from "next/server";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { sessionStore } from "@/lib/review/services";
import { settingsView } from "@/lib/settings/settings-service";

export default async function SettingsPage() {
  await connection();
  const view = await settingsView(sessionStore());
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mx-auto w-full max-w-[1680px] px-[clamp(var(--s-4),3vw,var(--s-7))] pt-s-5">
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-fg-muted max-md:hidden">
          Saved here, these win over the environment variables the app started with.
        </p>
      </header>
      <SettingsScreen initial={view} />
    </div>
  );
}
