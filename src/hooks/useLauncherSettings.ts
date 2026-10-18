import { useEffect, useState } from "react";
import { getLauncherSettings } from "../api";
import { defaultEditor, defaultTerminal, emptyAvailability } from "../lib/launchers";
import type { LauncherSettingsView } from "../types";

const fallback: LauncherSettingsView = {
  defaultEditor,
  defaultTerminal,
  availability: emptyAvailability,
};

export function useLauncherSettings() {
  const [launcherSettings, setLauncherSettings] =
    useState<LauncherSettingsView | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLauncherSettings()
      .then((settings) => {
        if (!cancelled) setLauncherSettings(settings);
      })
      .catch(() => {
        if (!cancelled) setLauncherSettings(fallback);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { launcherSettings, setLauncherSettings };
}
