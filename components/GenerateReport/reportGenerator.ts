import type { ExcelRow } from "./types";
import { isControllerDetail, isRackDetail, isSkippedDetail, runMatchers } from "./matchers";
import { collapseSpaces, normalize } from "./reportUtils";
import { parseInventory } from "./inventory";
import {
  makeLocationMatcher,
  parseSections,
  sectionKeywords,
  type SectionMode,
} from "./sections";

const isIPCameraModelInText = (d: string, devices: ExcelRow[]): boolean => {
  const dNorm = collapseSpaces(d);
  return devices.some(([, deviceType, , model]) => {
    if (!model || !normalize(deviceType).includes("ipcamera")) return false;
    const modelNorm = collapseSpaces(String(model));
    return modelNorm.length > 2 && dNorm.includes(modelNorm);
  });
};

const isOutletRow = (row: ExcelRow): boolean => {
  const d = String(row[1] ?? "").toLowerCase().replace(/\s+/g, " ");
  return d.includes("outlet") && (d.includes("lan") || d.includes("โทรศัพท์"));
};

export const isAPRow = (d: string) =>
  d.includes("access point") ||
  d.includes("accesspoint") ||
  d.includes("acess point") ||
  d.includes("acesspoint") ||
  d.includes("wifi");

export type ReportOptions = {
  sectionMode?: SectionMode;
  // Section index → comma-separated Location keywords (custom mode).
  customKeywords?: Record<number, string>;
  // Cap each device category to the quantity listed in the estimate section
  // (for one building split across several estimates). Default off: report
  // every inventory device found in the section.
  limitToEstimateQty?: boolean;
  // `${sectionIdx}:${category}` → Device Names picked by hand (wins over limit).
  deviceSelection?: Record<string, string[]>;
  // Picker support: called per section/category with all candidate rows + the
  // estimate qty. Use with generateReportText and discard the text.
  collect?: (info: {
    sectionIdx: number;
    sectionNo: number;
    sectionName: string;
    cat: string;
    qty: number;
    rows: ExcelRow[];
  }) => void;
};

export const generateReportText = (
  projectData: ExcelRow[],
  inventoryRows: ExcelRow[],
  options: ReportOptions = {},
): string => {
  const {
    sectionMode = "header",
    customKeywords = {},
    limitToEstimateQty = false,
    deviceSelection = {},
    collect,
  } = options;
  const devices = parseInventory(inventoryRows).devices;
  let reportText = "";

  parseSections(projectData).forEach((building, sectionIdx) => {
    const buildingIndex = building.no + 1;
    reportText += `\n${building.no}. ${building.name}\n`;

    const inBuilding = makeLocationMatcher(
      sectionKeywords(building, sectionIdx, sectionMode, customKeywords),
    );
    const siblingDetails = building.rows.map((r) =>
      String(r[1] ?? "").toLowerCase().replace(/\s+/g, " "),
    );

    // outlet rows always last within each building
    const orderedRows = [
      ...building.rows.filter((r) => !isOutletRow(r)),
      ...building.rows.filter(isOutletRow),
    ];

    const isSWRow = (d: string) => d.includes("switch");
    const isRouterRow = (d: string) => d.includes("router");
    const isUPSRow = (d: string) => d.includes("ups");
    const isIPCamRow = (d: string) =>
      (d.includes("ip") && d.includes("camera")) ||
      d.includes("กล้อง") ||
      d.includes("cctv") ||
      isIPCameraModelInText(d, devices);
    const isIPPhoneRow = (d: string) =>
      d.includes("ip phone") || d.includes("ipphone") || d.includes("telephone");
    const isNVRRow = (d: string) => d.includes("nvr");

    const processed = new Set<string>();

    const categoryOf = (d: string): string | null => {
      if (isAPRow(d)) return "ap";
      // Controller before switch: the OC300 row says "JetStream switchs".
      if (isControllerDetail(d)) return "controller";
      if (isSWRow(d)) return "sw";
      if (isRouterRow(d)) return "router";
      if (isUPSRow(d)) return "ups";
      if (isIPCamRow(d)) return "ipcam";
      if (isIPPhoneRow(d)) return "ipphone";
      if (isNVRRow(d)) return "nvr";
      if (isRackDetail(d)) return "rack";
      if (d.includes("kbss")) return "kbss";
      return null;
    };

    // Quantity the estimate lists per device category in this section (cable /
    // accessory rows that are ignored don't count). Caps how many inventory
    // devices a category pulls in, so a building split across two estimates
    // doesn't print every device in both reports.
    const categoryQty: Record<string, number> = {};
    building.rows.forEach((r) => {
      if (!r[1]) return;
      const dd = String(r[1]).toLowerCase().replace(/\s+/g, " ");
      const c = categoryOf(dd);
      if (!c || dd.includes("ติดตั้งสาย") || isSkippedDetail(dd)) return;
      const q = Number(r[2]);
      if (Number.isFinite(q) && q > 0) categoryQty[c] = (categoryQty[c] ?? 0) + q;
    });

    let subItemIndex = 1;

    orderedRows.forEach((row) => {
      const [, detail, quantity] = row;
      if (!detail) return;

      const d = String(detail).toLowerCase().replace(/\s+/g, " ");

      // Each device category processed once per building — merged & sorted
      const cat = categoryOf(d);
      if (cat && processed.has(cat)) return;

      const outcome = runMatchers({
        d,
        rawDetail: detail,
        quantity,
        currentBuilding: building.name,
        inBuilding,
        inventoryData: devices,
        siblingDetails,
        buildingIndex,
        subItemIndex,
        limit: limitToEstimateQty && cat ? categoryQty[cat] : undefined,
        only:
          cat && deviceSelection[`${sectionIdx}:${cat}`]
            ? new Set(deviceSelection[`${sectionIdx}:${cat}`])
            : undefined,
        collect:
          cat && collect
            ? (rows) =>
                collect({
                  sectionIdx,
                  sectionNo: building.no,
                  sectionName: building.name,
                  cat,
                  qty: categoryQty[cat] ?? 0,
                  rows,
                })
            : undefined,
      });

      if (outcome?.type === "matched") {
        if (cat) processed.add(cat);
        reportText += outcome.text;
        subItemIndex = outcome.nextSubItemIndex;
      } else if (outcome?.type === "ignore") {
        // skip
      } else {
        reportText += `${building.no}.${subItemIndex} ${detail} \n`;
        reportText += `📌 ยังไม่มีข้อมูลใน InventoryData\n`;
        subItemIndex++;
      }
    });
  });

  return reportText
    .split("\n")
    .map((line) => line.trimStart())
    .join("\n");
};

export type PickerGroup = {
  key: string; // `${sectionIdx}:${cat}`
  sectionNo: number;
  sectionName: string;
  cat: string;
  qty: number;
  candidates: { name: string; model: string; location: string }[];
};

// Sections/categories where the inventory holds more devices than the estimate
// asks for — the user chooses which ones go into this report.
export const findOverQtyGroups = (
  projectData: ExcelRow[],
  inventoryRows: ExcelRow[],
  options: Pick<ReportOptions, "sectionMode" | "customKeywords"> = {},
): PickerGroup[] => {
  const groups = new Map<string, PickerGroup>();
  generateReportText(projectData, inventoryRows, {
    ...options,
    limitToEstimateQty: false,
    collect: ({ sectionIdx, sectionNo, sectionName, cat, qty, rows }) => {
      if (qty <= 0 || rows.length <= qty) return;
      const key = `${sectionIdx}:${cat}`;
      groups.set(key, {
        key,
        sectionNo,
        sectionName,
        cat,
        qty,
        candidates: rows.map((r) => ({
          name: String(r[6] ?? ""),
          model: String(r[3] ?? ""),
          location: String(r[8] ?? ""),
        })),
      });
    },
  });
  return [...groups.values()];
};
