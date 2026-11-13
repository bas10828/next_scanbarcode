import type { ExcelRow } from "./types";
import { COL, parseInventory } from "./inventory";
import { isControllerDetail, isSkippedDetail } from "./matchers";
import { isAPRow, type ReportOptions } from "./reportGenerator";
import { normalize } from "./reportUtils";
import { makeLocationMatcher, parseSections, sectionKeywords } from "./sections";

// Pre-generate checks shown in the web page only — never written into the
// report (over-delivery and back-ordered items are normal and fixed by hand).

export const CATEGORIES = ["ap", "sw", "router", "controller", "ups", "nvr", "ipcam", "ipphone"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  ap: "AP",
  sw: "Switch",
  router: "Router",
  controller: "Controller",
  ups: "UPS",
  nvr: "NVR",
  ipcam: "Camera",
  ipphone: "IP Phone",
};

const estimateCategory = (d: string): Category | null => {
  // Cable/installation rows ("ติดตั้งสาย UTP ... รวมติดตั้ง Access Point") are
  // labour, not devices.
  if (d.includes("ติดตั้งสาย") || d.includes("outlet")) return null;
  if (isControllerDetail(d)) return "controller";
  if (isAPRow(d)) return "ap";
  if (d.includes("switch")) return "sw";
  if (d.includes("router")) return "router";
  if (d.includes("ups")) return "ups";
  if (d.includes("nvr")) return "nvr";
  if ((d.includes("ip") && d.includes("camera")) || d.includes("กล้อง") || d.includes("cctv")) return "ipcam";
  if (d.includes("ip phone") || d.includes("ipphone") || d.includes("telephone")) return "ipphone";
  return null;
};

const deviceCategory = (row: ExcelRow): Category | null => {
  const type = normalize(row[COL.type]);
  const model = normalize(row[COL.model]);
  if (type.includes("controller") || type.includes("omada") || /oc200|oc220|oc300/.test(model)) return "controller";
  if (type.includes("accesspoint")) return "ap";
  if (type.includes("switch")) return "sw";
  if (type.includes("router")) return "router";
  if (type.includes("ups")) return "ups";
  if (type.includes("nvr")) return "nvr";
  if (type.includes("ipcamera")) return "ipcam";
  if (type.includes("phone")) return "ipphone";
  return null;
};

export type DeviceRef = { name: string; type: string; location: string };

export type SectionCheck = {
  index: number;
  no: number;
  name: string;
  keywords: string[];
  counts: Partial<Record<Category, { est: number; inv: number }>>;
  // Estimate rows dropped on purpose (SFP, patch cord, ground...).
  skipped: { detail: string; qty: string }[];
  deviceCount: number;
};

export type CheckResult = {
  inventoryWarnings: string[];
  inventoryError?: string;
  sections: SectionCheck[];
  unmatched: DeviceRef[];
  multiMatched: (DeviceRef & { sections: number[] })[];
};

const ref = (row: ExcelRow): DeviceRef => ({
  name: String(row[COL.name] ?? ""),
  type: String(row[COL.type] ?? ""),
  location: String(row[COL.location] ?? ""),
});

export const computeChecks = (
  projectData: ExcelRow[],
  inventoryRows: ExcelRow[],
  options: ReportOptions = {},
): CheckResult => {
  const { sectionMode = "header", customKeywords = {} } = options;
  const inv = parseInventory(inventoryRows);
  const sections = parseSections(projectData);

  const matchers = sections.map((s, i) =>
    makeLocationMatcher(sectionKeywords(s, i, sectionMode, customKeywords)),
  );
  const hits = inv.devices.map((row) =>
    sections.map((_, i) => i).filter((i) => matchers[i](row[COL.location])),
  );

  const sectionChecks: SectionCheck[] = sections.map((s, i) => {
    const counts: SectionCheck["counts"] = {};
    const bump = (cat: Category, key: "est" | "inv", n: number) => {
      const c = (counts[cat] ??= { est: 0, inv: 0 });
      c[key] += n;
    };
    const skipped: SectionCheck["skipped"] = [];

    s.rows.forEach((row) => {
      const d = String(row[1] ?? "").toLowerCase().replace(/\s+/g, " ");
      const cat = estimateCategory(d);
      if (cat) bump(cat, "est", Number(row[2]) || 0);
      else if (isSkippedDetail(d)) {
        skipped.push({ detail: String(row[1]).trim(), qty: [row[2], row[3]].filter(Boolean).join(" ") });
      }
    });

    let deviceCount = 0;
    inv.devices.forEach((row, r) => {
      if (!hits[r].includes(i)) return;
      deviceCount++;
      const cat = deviceCategory(row);
      if (cat) bump(cat, "inv", 1);
    });

    return {
      index: i,
      no: s.no,
      name: s.name,
      keywords: sectionKeywords(s, i, sectionMode, customKeywords),
      counts,
      skipped,
      deviceCount,
    };
  });

  return {
    inventoryWarnings: inv.warnings,
    inventoryError: inv.error,
    sections: sectionChecks,
    unmatched: inv.devices.filter((_, r) => hits[r].length === 0).map(ref),
    multiMatched: inv.devices
      .map((row, r) => ({ ...ref(row), sections: hits[r].map((i) => sections[i].no) }))
      .filter((d) => d.sections.length > 1),
  };
};
