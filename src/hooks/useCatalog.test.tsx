import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCatalog } from "../api";
import { useCatalog } from "./useCatalog";
import { makeCatalog, makeProject } from "../test/fixtures";

vi.mock("../api", () => ({
  getCatalog: vi.fn(),
}));

const mockedGetCatalog = vi.mocked(getCatalog);

describe("useCatalog", () => {
  beforeEach(() => {
    mockedGetCatalog.mockReset();
  });

  it("loads the catalog", async () => {
    const catalog = makeCatalog([makeProject()]);
    mockedGetCatalog.mockResolvedValue(catalog);

    const { result } = renderHook(() => useCatalog());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.catalog).toEqual(catalog);
    expect(result.current.error).toBeNull();
  });

  it("exposes a readable error", async () => {
    mockedGetCatalog.mockRejectedValue({
      code: "CATALOG_READ_FAILED",
      message: "broken",
    });

    const { result } = renderHook(() => useCatalog());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.code).toBe("CATALOG_READ_FAILED");
  });

  it("retries after a failure", async () => {
    const catalog = makeCatalog([makeProject()]);
    mockedGetCatalog
      .mockRejectedValueOnce({ code: "INTERNAL", message: "first failure" })
      .mockResolvedValueOnce(catalog);

    const { result } = renderHook(() => useCatalog());
    await waitFor(() => expect(result.current.error).not.toBeNull());

    await act(async () => {
      await result.current.reload();
    });

    await waitFor(() => expect(result.current.catalog).toEqual(catalog));
    expect(result.current.error).toBeNull();
  });
});
