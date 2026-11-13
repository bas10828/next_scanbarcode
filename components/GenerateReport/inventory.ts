import type { ExcelRow } from "./types";

// Canonical column order every matcher reads. Inventory files are remapped into
// this order by header name, so adding/removing/reordering columns in the xlsx
// no longer shifts S/N into the MAC slot etc.
export const COL = {
  no: 0,
  type: 1,
  brand: 2,
  model: 3,
  serial: 4,
  mac: 5,
  name: 6,
  ip: 7,
  location: 8,
  remark: 9,
} as const;

type ColKey = keyof typeof COL;

const HEADER_ALIASES: Record<ColKey, string[]> = {
  no: ["no", "no.", "ลำดับ", "ลำดับที่"],
  type: ["devicetype", "type", "ประเภท"],
  brand: ["brand", "ยี่ห้อ"],
  model: ["model", "รุ่น"],
  // "Serail" is the spelling used in the inventory template.
  serial: ["serialnumber", "serailnumber", "serial", "s/n", "sn"],
  mac: ["macaddress", "mac"],
  name: ["devicename", "name"],
  ip: ["ipaddress", "ip"],
  location: ["location", "ตำแหน่ง", "สถานที่"],
  remark: ["remark", "หมายเหตุ"],
};

const REQUIRED: ColKey[] = ["type", "model", "serial", "name", "location"];

const DISPLAY_NAME: Record<ColKey, string> = {
  no: "NO.",
  type: "Device Type",
  brand: "Brand",
  model: "Model",
  serial: "Serial Number",
  mac: "MAC Address",
  name: "Device Name",
  ip: "IP Address",
  location: "Location",
  remark: "Remark",
};

const headerKey = (cell: unknown): string =>
  String(cell ?? "").toLowerCase().replace(/[\s.]/g, "");

const aliasKeys = Object.fromEntries(
  Object.entries(HEADER_ALIASES).map(([k, list]) => [k, list.map(headerKey)]),
) as Record<ColKey, string[]>;

export type InventoryParseResult = {
  // Device rows only (no title/header rows), in canonical COL order.
  devices: ExcelRow[];
  warnings: string[];
  // When set, the inventory cannot be used to generate a report.
  error?: string;
};

const isDeviceRow = (row: ExcelRow): boolean =>
  Boolean(row[COL.model]) || Boolean(row[COL.name]);

export const parseInventory = (rows: ExcelRow[]): InventoryParseResult => {
  const warnings: string[] = [];

  let headerIdx = -1;
  let mapping: Partial<Record<ColKey, number>> = {};
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const found: Partial<Record<ColKey, number>> = {};
    rows[i].forEach((cell, c) => {
      const key = headerKey(cell);
      if (!key) return;
      for (const col of Object.keys(aliasKeys) as ColKey[]) {
        if (found[col] === undefined && aliasKeys[col].includes(key)) {
          found[col] = c;
          break;
        }
      }
    });
    if (Object.keys(found).length >= 3) {
      headerIdx = i;
      mapping = found;
      break;
    }
  }

  if (headerIdx === -1) {
    // Old behaviour: fixed column positions, first row skipped.
    warnings.push("ไม่เจอแถวหัวคอลัมน์ใน Inventory — ใช้ตำแหน่งคอลัมน์แบบเดิม (B=Type, D=Model, E=S/N, G=Device Name, I=Location)");
    return { devices: rows.slice(1).filter(isDeviceRow), warnings };
  }

  const missing = REQUIRED.filter((k) => mapping[k] === undefined);
  if (missing.length > 0) {
    return {
      devices: [],
      warnings,
      error: `Inventory ไม่มีคอลัมน์: ${missing.map((k) => DISPLAY_NAME[k]).join(", ")}`,
    };
  }

  const width = Object.keys(COL).length;
  const devices = rows
    .slice(headerIdx + 1)
    .map((row) => {
      const out: ExcelRow = new Array(width).fill(null);
      for (const [col, idx] of Object.entries(mapping) as [ColKey, number][]) {
        out[COL[col]] = row[idx] ?? null;
      }
      return out;
    })
    .filter(isDeviceRow);

  return { devices, warnings };
};
