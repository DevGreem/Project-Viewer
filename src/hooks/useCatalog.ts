import { useCallback, useEffect, useState } from "react";
import { getCatalog } from "../api";
import { isAppError } from "../lib/errors";
import type { AppError, CatalogView } from "../types";

export function useCatalog() {
  const [catalog, setCatalog] = useState<CatalogView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getCatalog();
      setCatalog(next);
    } catch (caught) {
      setError(
        isAppError(caught)
          ? caught
          : { code: "INTERNAL", message: String(caught) },
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { catalog, loading, error, reload: load, setCatalog };
}
