import type { ExcelRow } from "./types";
import { runMatchers } from "./matchers";

const isOutletRow = (row: ExcelRow): boolean => {
  const d = String(row[1] ?? "").toLowerCase().replace(/\s+/g, " ");
  return d.includes("outlet") && (d.includes("lan") || d.includes("โทรศัพท์"));
};

export const generateReportText = (
  projectData: ExcelRow[],
  inventoryData: ExcelRow[],
): string => {
  let reportText = "";

  // Group sub-rows by building section
  type BuildingGroup = { no: number; name: string; rows: ExcelRow[] };
  const buildings: BuildingGroup[] = [];
  let currentGroup: BuildingGroup | null = null;

  projectData.forEach((row) => {
    const [no, detail] = row;
    if (no === "ลำดับ" || no === "ลำดับที่" || !detail) return;

    if (no !== null && no !== "" && !isNaN(Number(no))) {
      currentGroup = { no: Number(no), name: String(detail).trim(), rows: [] };
      buildings.push(currentGroup);
    } else if (currentGroup && detail && !no) {
      currentGroup.rows.push(row);
    }
  });

  buildings.forEach((building) => {
    const buildingIndex = building.no + 1;
    reportText += `\n${building.no}. ${building.name}\n`;

    // outlet rows always last within each building
    const orderedRows = [
      ...building.rows.filter((r) => !isOutletRow(r)),
      ...building.rows.filter(isOutletRow),
    ];

    const isAPRow = (d: string) =>
      d.includes("access point") ||
      d.includes("accesspoint") ||
      d.includes("acess point") ||
      d.includes("acesspoint") ||
      d.includes("wifi");
    const isSWRow = (d: string) => d.includes("switch");
    const isRouterRow = (d: string) => d.includes("router");
    const isUPSRow = (d: string) => d.includes("ups");
    const isIPCamRow = (d: string) => d.includes("ip") && d.includes("camera");
    const isIPPhoneRow = (d: string) =>
      d.includes("ip phone") || d.includes("ipphone") || d.includes("telephone");
    const isControllerRow = (d: string) =>
      d.includes("controller") ||
      d.includes("oc200") ||
      d.includes("oc220") ||
      d.includes("oc300");
    const isNVRRow = (d: string) => d.includes("nvr");

    const processed = new Set<string>();

    const categoryOf = (d: string): string | null => {
      if (isAPRow(d)) return "ap";
      if (isSWRow(d)) return "sw";
      if (isRouterRow(d)) return "router";
      if (isUPSRow(d)) return "ups";
      if (isIPCamRow(d)) return "ipcam";
      if (isIPPhoneRow(d)) return "ipphone";
      if (isControllerRow(d)) return "controller";
      if (isNVRRow(d)) return "nvr";
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
        inventoryData,
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
