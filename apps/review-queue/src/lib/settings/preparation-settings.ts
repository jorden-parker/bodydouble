import type { SessionStore } from "@/lib/session/store";

const SETTING_KEY = "prepare-next-pr";

export function savedPreparationSetting(store: SessionStore): boolean {
  return store.getSetting(SETTING_KEY) === "on";
}

export function savePreparationSetting(store: SessionStore, isOn: boolean): void {
  store.setSetting(SETTING_KEY, isOn ? "on" : "off");
}
