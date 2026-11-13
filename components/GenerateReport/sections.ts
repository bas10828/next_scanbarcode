import type { ExcelRow } from "./types";
import { COL } from "./inventory";
import { normalize } from "./reportUtils";

export type Section = { no: number; name: string; rows: ExcelRow[] };

// Column A number = section header (building), rows below with empty column A
// are its items.
export const parseSections = (projectData: ExcelRow[]): Section[] => {
  const sections: Section[] = [];
  let current: Section | null = null;

  projectData.forEach((row) => {
    const [no, detail] = row;
    if (no === "ลำดับ" || no === "ลำดับที่" || !detail) return;

    if (no !== null && no !== undefined && no !== "" && !isNaN(Number(no))) {
      current = { no: Number(no), name: String(detail).trim(), rows: [] };
      sections.push(current);
    } else if (current && !no) {
      current.rows.push(row);
    }
  });

  return sections;
};

// "header": a device belongs to a section when its Location contains the
// section name (original behaviour — also catches typos in either file).
// "custom": the user types the Location keywords for each section.
export type SectionMode = "header" | "custom";

// Comma-separated keywords; a device matches if its Location contains any.
export const splitKeywords = (text: string): string[] =>
  text
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

export const sectionKeywords = (
  section: Section,
  index: number,
  mode: SectionMode,
  custom: Record<number, string>,
): string[] => {
  if (mode === "custom" && custom[index] !== undefined) {
    const kws = splitKeywords(custom[index]);
    if (kws.length > 0) return kws;
  }
  return [section.name];
};

export const makeLocationMatcher = (keywords: string[]) => {
  const keys = keywords.map(normalize).filter(Boolean);
  return (location: unknown): boolean => {
    const loc = normalize(location);
    return keys.some((k) => loc.includes(k));
  };
};

export const deviceLocation = (row: ExcelRow) => row[COL.location];
