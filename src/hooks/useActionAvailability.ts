import { useEffect, useState } from "react";
import { getActionAvailability } from "../api";
import type { ActionAvailability } from "../types";

const unavailable: ActionAvailability = {
  folder: false,
  vscode: false,
  terminal: false,
  terminalName: null,
};

export function useActionAvailability() {
  const [availability, setAvailability] =
    useState<ActionAvailability>(unavailable);

  useEffect(() => {
    let cancelled = false;
    getActionAvailability()
      .then((next) => {
        if (!cancelled) setAvailability(next);
      })
      .catch(() => {
        if (!cancelled) setAvailability(unavailable);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return availability;
}
