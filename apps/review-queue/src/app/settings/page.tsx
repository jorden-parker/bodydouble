import { connection } from "next/server";
import { PageHeader, PageShell } from "@/components/common/page-shell";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { sessionStore } from "@/lib/review/services";
import { settingsView } from "@/lib/settings/settings-service";

export default async function SettingsPage() {
  await connection();
  const view = await settingsView(sessionStore());
  return (
    <PageShell isNarrow>
      <PageHeader
        title="Settings"
        lede="Saved here, these win over the environment variables the app started with."
      />
      <SettingsScreen initial={view} />
    </PageShell>
  );
}
