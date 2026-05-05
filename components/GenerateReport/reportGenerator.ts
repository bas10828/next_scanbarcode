import type { ExcelRow } from "./types";
import { runMatchers } from "./matchers";

export const generateReportText = (
  projectData: ExcelRow[],
  inventoryData: ExcelRow[],
): string => {
  let reportText = "";
  let currentBuilding: string | null = null;
  let buildingIndex = 1;
  let subItemIndex = 1;

  projectData.forEach((row) => {
    const [no, detail, quantity] = row;

    if (no === "ลำดับ" || no === "ลำดับที่" || !detail) return;

    if (no !== null && no !== "" && !isNaN(Number(no))) {
      currentBuilding = String(detail).trim();
      reportText += `\n${no}. ${currentBuilding}\n`;
      buildingIndex = Number(no) + 1;
      subItemIndex = 1;
      return;
    }

    if (!(currentBuilding && detail && !no)) return;

    const d = String(detail).toLowerCase().replace(/\s+/g, " ");
    const outcome = runMatchers({
      d,
      rawDetail: detail,
      quantity,
      currentBuilding: currentBuilding!,
      inventoryData,
      buildingIndex,
      subItemIndex,
    });

    if (outcome?.type === "matched") {
      reportText += outcome.text;
      subItemIndex = outcome.nextSubItemIndex;
    } else if (outcome?.type === "ignore") {
      // matched a skip/ignore rule — write nothing, no fallback
    } else {
      // category matched but no inventory, OR no matcher claimed it → fallback
      reportText += `${buildingIndex - 1}.${subItemIndex} ${detail} \n`;
      reportText += `📌 ยังไม่มีข้อมูลใน InventoryData\n`;
      subItemIndex++;
    }
  });

  return reportText
    .split("\n")
    .map((line) => line.trimStart())
    .join("\n");
};
