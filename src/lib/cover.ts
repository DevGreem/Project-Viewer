import { convertFileSrc } from "@tauri-apps/api/core";

export function coverUrl(dataDir: string, cover: string | null): string | null {
  if (!cover) {
    return null;
  }
  const base = dataDir.endsWith("/") ? dataDir.slice(0, -1) : dataDir;
  const absolute = `${base}/${cover}`;

  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return `asset://localhost/${encodeURIComponent(absolute)}`;
  }

  try {
    return convertFileSrc(absolute);
  } catch {
    return null;
  }
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function toneFor(seed: string): { from: string; to: string } {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    from: `hsl(${hue} 72% 42%)`,
    to: `hsl(${(hue + 48) % 360} 78% 30%)`,
  };
}
