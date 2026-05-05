export const normalize = (s: unknown): string =>
  String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace("rg-", "");

export const collapseSpaces = (s: unknown): string =>
  String(s ?? "").toLowerCase().replace(/\s+/g, "");
