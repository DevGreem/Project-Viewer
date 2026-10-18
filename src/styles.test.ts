import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("responsive project grid", () => {
  it("defines an auto-fill grid and compact breakpoints", () => {
    const css = readFileSync("src/App.css", "utf8");
    expect(css).toContain(
      "grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));",
    );
    expect(css).toContain("@media (max-width: 820px)");
    expect(css).toContain("@media (max-width: 560px)");
  });
});
