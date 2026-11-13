import type { ReportImage } from "./types";

// The label of a report line is the device name in "(...)". Device lines put it
// right before " S/N:", so prefer that one — a Location such as
// "อาคาร 3 (ห้องประชุม)" after the S/N must not become the label.
export const labelForLine = (line: string): string | null => {
  const beforeSN = line.match(/\(([^()]+)\)\s*S\/N:/);
  if (beforeSN) return beforeSN[1].trim();
  const matches = Array.from(line.matchAll(/\(([^()]+)\)/g));
  const candidates = matches.filter((m) => m[1].length > 4 || /[A-Za-z]/.test(m[1]));
  if (candidates.length === 0) return null;
  return candidates[candidates.length - 1][1].trim();
};

const stem = (fileName: string): string =>
  fileName
    .replace(/\.[^.]+$/, "")
    .replace(/^edited_/i, "")
    .trim()
    .toUpperCase();

const isWordChar = (ch: string) => ch !== "" && /[\p{L}\p{M}\p{N}]/u.test(ch);

// Labels that appear in the file name as whole tokens (not glued to a letter or
// digit on either side). When one hit lies inside a longer hit, only the longer
// label counts. So:
//   "AP01-1(2).jpg"                     → AP01
//   "AP010.jpg"                         → nothing for AP01
//   "RACK-อาคารA-SW01-POE.jpg"         → อาคารA-SW01-POE (not SW01-POE)
//   "SW-POE-FOOD-01-1-UPS-FOOD-01.jpg"  → SW-POE-FOOD-01 and UPS-FOOD-01
export const labelsInFileName = (fileName: string, labels: string[]): string[] => {
  const s = stem(fileName);
  const hits: { label: string; start: number; end: number }[] = [];
  for (const label of new Set(labels)) {
    const l = label.trim().toUpperCase();
    if (!l) continue;
    let from = 0;
    for (let at = s.indexOf(l, from); at !== -1; at = s.indexOf(l, from)) {
      const end = at + l.length;
      if (!isWordChar(s.charAt(at - 1)) && !isWordChar(s.charAt(end))) {
        hits.push({ label, start: at, end });
      }
      from = at + 1;
    }
  }
  return Array.from(
    new Set(
      hits
        .filter(
          (h) =>
            !hits.some(
              (o) => o !== h && o.start <= h.start && o.end >= h.end && o.end - o.start > h.end - h.start,
            ),
        )
        .map((h) => h.label),
    ),
  );
};

export const computeLineImages = (
  reportText: string,
  images: ReportImage[],
): Record<number, ReportImage[]> => {
  if (images.length === 0) return {};
  const lineLabels = reportText.split("\n").map(labelForLine);
  const allLabels = lineLabels.filter((l): l is string => l !== null);
  const imageLabels = images.map((img) => labelsInFileName(img.name, allLabels));

  const result: Record<number, ReportImage[]> = {};
  lineLabels.forEach((label, idx) => {
    if (!label) return;
    const matched = images.filter((_, i) => imageLabels[i].includes(label));
    if (matched.length > 0) result[idx] = matched;
  });
  return result;
};

export type ImageCheck = {
  // Uploaded photos that no report line picked up (typo in file name?).
  unused: string[];
  // Photos attached to more than one line, e.g. outlet "L01" exists in
  // several buildings.
  shared: { name: string; lines: string[] }[];
};

export const checkImages = (
  reportText: string,
  images: ReportImage[],
  lineImages: Record<number, ReportImage[]>,
): ImageCheck => {
  const lines = reportText.split("\n");
  const usage = new Map<string, string[]>();
  Object.entries(lineImages).forEach(([idx, imgs]) => {
    imgs.forEach((img) => {
      const list = usage.get(img.name) ?? [];
      list.push(lines[Number(idx)].split(" ")[0]);
      usage.set(img.name, list);
    });
  });
  return {
    unused: images.filter((img) => !usage.has(img.name)).map((img) => img.name),
    shared: Array.from(usage.entries())
      .filter(([, l]) => l.length > 1)
      .map(([name, l]) => ({ name, lines: l })),
  };
};
