import { useEffect, useState } from "react";
import { getAutostartState } from "../api";
import type { AutostartState } from "../types";

export function useAutostart() {
  const [autostart, setAutostart] = useState<AutostartState | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAutostartState()
      .then((state) => {
        if (!cancelled) setAutostart(state);
      })
      .catch(() => {
        if (!cancelled) {
          setAutostart({ available: false, enabled: false, devMode: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { autostart, setAutostart };
}
