import type { ExcelRow } from "./types";
import { isControllerDetail, isRackDetail, runMatchers } from "./matchers";
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
};

export const generateReportText = (
  projectData: ExcelRow[],
  inventoryRows: ExcelRow[],
  options: ReportOptions = {},
): string => {
  const { sectionMode = "header", customKeywords = {} } = options;
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
