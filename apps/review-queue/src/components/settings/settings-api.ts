import type { LlmSettings } from "@/lib/settings/llm-settings";
import type { SettingsView } from "@/lib/settings/settings-service";
import { postJson } from "@/lib/json-response";

type SettingsUpdate = { llm?: LlmSettings; repositories?: string[] };

export function saveSettings(update: SettingsUpdate): Promise<SettingsView> {
  return postJson<SettingsView>("/api/settings", update, "PUT");
}

export function clearCache(): Promise<{ cleared: number }> {
  return postJson<{ cleared: number }>("/api/settings/cache", {}, "DELETE");
}
