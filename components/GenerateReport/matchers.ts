import type { ExcelRow, Matcher, MatcherContext, MatcherOutcome } from "./types";
import { collapseSpaces, normalize } from "./reportUtils";

// Picks which inventory rows a matcher reports.
//  - ctx.collect: receives every candidate row (sorted) — used by the web picker.
//  - ctx.only: Device Names the user chose explicitly (wins over limit).
//  - ctx.limit: quantity the estimate asks for; when the inventory holds more
//    (one building split across several estimates), the first N by Device Name.
const sortByDeviceName = (rows: ExcelRow[], ctx: MatcherContext): ExcelRow[] => {
  const sorted = [...rows].sort((a, b) => String(a[6] ?? "").localeCompare(String(b[6] ?? "")));
  ctx.collect?.(sorted);
  if (ctx.only) return sorted.filter((r) => ctx.only!.has(String(r[6] ?? "")));
  const limit = ctx.limit;
  return limit !== undefined && limit > 0 && sorted.length > limit ? sorted.slice(0, limit) : sorted;
};

export const isControllerDetail = (d: string): boolean => {
  const isOmadaModel = d.includes("oc200") || d.includes("oc220") || d.includes("oc300");
  return (
    (d.includes("controller") || isOmadaModel) &&
    (!d.includes("switch") || isOmadaModel) &&
    !d.includes("access point") &&
    !d.includes("router")
  );
};

const accessPoint: Matcher = (ctx) => {
  const { d, inBuilding, inventoryData, buildingIndex, subItemIndex } = ctx;
  const isAP =
    d.includes("access point") ||
    d.includes("accesspoint") ||
    d.includes("acess point") ||
    d.includes("acesspoint") ||
    d.includes("wifi");
  if (!isAP) return null;

  const isOmadaControllerModel = (m: unknown) => {
    const mn = normalize(m);
    return mn.includes("oc200") || mn.includes("oc220") || mn.includes("oc300");
  };

  const aps = sortByDeviceName(
    inventoryData
      .filter(([, deviceType, , model, , , , , location]) => {
        if (!model) return false;
        const type = normalize(deviceType);
        return (
          type.includes("accesspoint") &&
          !isOmadaControllerModel(model) &&
          inBuilding(location)
        );
      }), ctx);

  if (aps.length === 0) return { type: "category-no-inv" };

  let text = "";
  let subSubItemIndex = 1;
  aps.forEach(([, , brand, model, serialNumber, , deviceName, , location]) => {
    text += `${buildingIndex - 1}.${subItemIndex}.${subSubItemIndex} ติดตั้ง Access Point ${
      brand ?? ""
    } ${model ?? ""} พร้อมเดินร้อยท่อ PVC สีขาว (${deviceName ?? ""}) S/N: ${
      serialNumber ?? ""
    } ${location ?? ""}\n`;
    subSubItemIndex++;
  });
  return { type: "matched", text, nextSubItemIndex: subItemIndex + 1 };
};

const apWithCableSkip: Matcher = (ctx) => {
  if (ctx.d.includes("ติดตั้งสาย") && ctx.d.includes("access point")) {
    return { type: "ignore" };
  }
  return null;
};

const controller: Matcher = (ctx) => {
  const { d, inBuilding, inventoryData, buildingIndex, subItemIndex } = ctx;
  if (!isControllerDetail(d)) return null;

  const controllers = sortByDeviceName(
    inventoryData.filter(([, deviceType, , model, , , , , location]) => {
      if (!model) return false;
      const type = normalize(deviceType);
      return (type.includes("controller") || type.includes("omada")) && inBuilding(location);
    }), ctx);

  if (controllers.length === 0) return { type: "category-no-inv" };

  let text = "";
  let nextSub = subItemIndex;
  controllers.forEach(([, , brand, model, serialNumber, , deviceName, , location]) => {
    text += `${buildingIndex - 1}.${nextSub} ติดตั้งอุปกรณ์บริหารจัดการระบบเครือข่าย (Controller) ${
      brand ?? ""
    } ${model ?? ""} (${deviceName ?? ""}) S/N: ${serialNumber ?? ""} ${location ?? ""}\n`;
    nextSub++;
  });
  return { type: "matched", text, nextSubItemIndex: nextSub };
};

const injector: Matcher = (ctx) => {
  const { d, inBuilding, inventoryData, buildingIndex, subItemIndex } = ctx;
  if (!d.includes("injector") && !d.includes("poe160") && !d.includes("poe260")) return null;

  const dNormalized = collapseSpaces(d);

  const injectors = sortByDeviceName(
    inventoryData.filter((row) => {
      const [, , , model, , , , , location] = row;
      if (!model) return false;
      const modelNorm = collapseSpaces(String(model));
      return modelNorm.length > 2 && dNormalized.includes(modelNorm) && inBuilding(location);
    }), ctx);

  if (injectors.length === 0) return { type: "category-no-inv" };

  let text = "";
  let subSubItemIndex = 1;
  injectors.forEach(([, , brand, model, serialNumber, , deviceName, , location]) => {
    text += `${buildingIndex - 1}.${subItemIndex}.${subSubItemIndex} ติดตั้ง PoE Injector ${
      brand ?? ""
    } ${model ?? ""} (${deviceName ?? ""}) S/N: ${serialNumber ?? ""} ${location ?? ""}\n`;
    subSubItemIndex++;
  });
  return { type: "matched", text, nextSubItemIndex: subItemIndex + 1 };
};

const switchMatcher: Matcher = (ctx) => {
  const { d, inBuilding, inventoryData, buildingIndex, subItemIndex } = ctx;
  if (!d.includes("switch")) return null;
  // "Omada Hardware Controller ... JetStream switchs" is a controller row.
  if (isControllerDetail(d)) return null;

  // Compare models with spaces/hyphens stripped: quotations write
  // "NBS3100-24GT4SFP-P V2" while inventory exports "NBS3100-24GT4SFP-P-V2".
  const modelKey = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const dKey = modelKey(d);

  const switchRows = inventoryData.filter(([, deviceType, , model]) => {
    if (!model) return false;
    return normalize(deviceType).includes("switch");
  });

  const matchedModelRows = switchRows.filter(([, , , model]) => {
    const mk = modelKey(model);
    return mk.length > 3 && dKey.includes(mk);
  });

  // A row naming a specific model only pulls that model; a generic
  // "16-Port Gigabit Smart POE Switch" line pulls every switch in the building.
  const candidateRows = matchedModelRows.length > 0 ? matchedModelRows : switchRows;

  const switches = sortByDeviceName(
    candidateRows.filter(([, , , , , , , , location]) => inBuilding(location)), ctx);

  if (switches.length === 0) return { type: "category-no-inv" };

  let text = "";
  let subSubItemIndex = 1;
  switches.forEach(([, , brand, model, serialNumber, , deviceName, , location]) => {
    text += `${buildingIndex - 1}.${subItemIndex}.${subSubItemIndex} ติดตั้ง Switch ${
      brand ?? ""
    } ${model ?? ""} (${deviceName ?? ""}) S/N: ${serialNumber ?? ""} ${location ?? ""}\n`;
    subSubItemIndex++;
  });
  return { type: "matched", text, nextSubItemIndex: subItemIndex + 1 };
};

const ipPhone: Matcher = (ctx) => {
  const { d, inBuilding, inventoryData, buildingIndex, subItemIndex } = ctx;
  if (
    !d.includes("ip phone") &&
    !d.includes("ipphone") &&
    !d.includes("telephone")
  )
    return null;

  const phones = sortByDeviceName(
    inventoryData.filter((row) => {
      const [, deviceType, , model, , , , , location] = row;
      if (!model) return false;
      const typeNorm = normalize(deviceType);
      const matchType =
        typeNorm.includes("phone") ||
        typeNorm.includes("ipphone") ||
        typeNorm.includes("telephone");
      return matchType && inBuilding(location);
    }), ctx);

  if (phones.length === 0) return { type: "category-no-inv" };

  let text = "";
  let subSubItemIndex = 1;
  phones.forEach(([, , brand, model, serialNumber, , deviceName, , location]) => {
    text += `${buildingIndex - 1}.${subItemIndex}.${subSubItemIndex} ติดตั้งเครื่องโทรศัพท์ IP Phone ${
      brand ?? ""
    } ${model ?? ""} (${deviceName ?? ""}) S/N: ${serialNumber ?? ""} ${location ?? ""}\n`;
    subSubItemIndex++;
  });
  return { type: "matched", text, nextSubItemIndex: subItemIndex + 1 };
};

const stabilizer: Matcher = (ctx) => {
  const { d, inBuilding, inventoryData, buildingIndex, subItemIndex } = ctx;
  if (!d.includes("stabilizer")) return null;

  const stabilizers = inventoryData.filter(
    ([, deviceType, , , , , , , location]) =>
      deviceType &&
      String(deviceType).toLowerCase() === "stabilizer" &&
      inBuilding(location),
  );

  if (stabilizers.length === 0) return { type: "category-no-inv" };

  let text = "";
  let nextSub = subItemIndex;
  stabilizers.forEach(([, , , model, serialNumber, , deviceName, , location]) => {
    text += `${buildingIndex - 1}.${nextSub} ติดตั้งเครื่องควบคุมแรงดันไฟฟ้าอัตโนมัติ Stabilizer ${
      model ?? ""
    } (${deviceName ?? ""}) S/N: ${serialNumber ?? ""} ${location ?? ""}\n`;
    nextSub++;
  });
  return { type: "matched", text, nextSubItemIndex: nextSub };
};

const router: Matcher = (ctx) => {
  const { d, inBuilding, inventoryData, buildingIndex, subItemIndex } = ctx;
  if (!d.includes("router")) return null;

  const routers = sortByDeviceName(
    inventoryData.filter((row) => {
      const [, deviceType, , model, , , , , location] = row;
      if (!model) return false;
      const typeNorm = normalize(deviceType);
      return typeNorm.includes("router") && inBuilding(location);
    }), ctx);

  if (routers.length === 0) return { type: "category-no-inv" };

  let text = "";
  let subSubItemIndex = 1;
  routers.forEach(([, , brand, model, serialNumber, , deviceName, , location]) => {
    if (!model) return;
    text += `${buildingIndex - 1}.${subItemIndex}.${subSubItemIndex} ติดตั้ง Router ${
      brand ?? ""
    } ${model ?? ""} (${deviceName ?? ""}) S/N: ${serialNumber ?? ""} ${location ?? ""}\n`;
    subSubItemIndex++;
  });

  if (subSubItemIndex === 1) return { type: "category-no-inv" };
  return { type: "matched", text, nextSubItemIndex: subItemIndex + 1 };
};

const ups: Matcher = (ctx) => {
  const { d, inBuilding, inventoryData, buildingIndex, subItemIndex } = ctx;
  if (!d.toLowerCase().includes("ups")) return null;

  const upsList = sortByDeviceName(
    inventoryData.filter(
      ([, deviceType, , model, , , , , location]) => {
        if (!model) return false;
        const type = String(deviceType ?? "").toLowerCase().trim();
        return type.includes("ups") && inBuilding(location);
      },
    ), ctx);

  if (upsList.length === 0) return { type: "category-no-inv" };

  let text = "";
  let nextSub = subItemIndex;
  upsList.forEach(([, , brand, model, serialNumber, , deviceName, , location]) => {
    text += `${buildingIndex - 1}.${nextSub} ติดตั้ง UPS ${brand ?? ""} ${
      model ?? ""
    } (${deviceName ?? ""}) S/N: ${serialNumber ?? ""} ${location ?? ""}\n`;
    nextSub++;
  });
  return { type: "matched", text, nextSubItemIndex: nextSub };
};

const ipCamera: Matcher = (ctx) => {
  const { d, inBuilding, inventoryData, buildingIndex, subItemIndex } = ctx;
  const dNormalized = collapseSpaces(d);

  const cameraRows = inventoryData.filter(([, deviceType]) =>
    normalize(deviceType).includes("ipcamera"),
  );

  const hasKeyword =
    (d.includes("ip") && d.includes("camera")) || d.includes("กล้อง") || d.includes("cctv");

  const matchedModelRows = cameraRows.filter(([, , , model]) => {
    if (!model) return false;
    const modelNorm = collapseSpaces(String(model));
    return modelNorm.length > 2 && dNormalized.includes(modelNorm);
  });

  if (!hasKeyword && matchedModelRows.length === 0) return null;

  // A row naming a specific model only pulls that model; a generic
  // "install/relocate camera" line pulls every camera in the building.
  const candidateRows = matchedModelRows.length > 0 ? matchedModelRows : cameraRows;

  const ipCameras = sortByDeviceName(
    candidateRows.filter(([, , , model, , , , , location]) => {
      if (!model) return false;
      return inBuilding(location);
    }), ctx);

  if (ipCameras.length === 0) return { type: "category-no-inv" };

  let text = "";
  let subSubItemIndex = 1;
  ipCameras.forEach(([, , brand, model, serialNumber, , deviceName, , location]) => {
    text += `${buildingIndex - 1}.${subItemIndex}.${subSubItemIndex} ติดตั้งกล้องพร้อมเดินร้อยท่อ PVC สีขาว IP Camera ${
      brand ?? ""
    } ${model ?? ""} (${deviceName ?? ""}) S/N: ${serialNumber ?? ""} ${location ?? ""}\n`;
    subSubItemIndex++;
  });
  return { type: "matched", text, nextSubItemIndex: subItemIndex + 1 };
};

const nvr: Matcher = (ctx) => {
  const { d, inBuilding, inventoryData, buildingIndex, subItemIndex } = ctx;
  if (!d.toLowerCase().includes("nvr")) return null;

  const nvrs = sortByDeviceName(
    inventoryData.filter(
      ([, deviceType, , , , , , , location]) => {
        const type = String(deviceType ?? "").toLowerCase();
        return type.includes("nvr") && inBuilding(location);
      },
    ), ctx);

  if (nvrs.length === 0) return { type: "category-no-inv" };

  let text = "";
  let nextSub = subItemIndex;
  nvrs.forEach(([, , brand, model, serialNumber, , deviceName, , location]) => {
    text += `${buildingIndex - 1}.${nextSub} ติดตั้งเครื่องบันทึก NVR ${brand ?? ""} ${
      model ?? ""
    } (${deviceName ?? ""}) S/N: ${serialNumber ?? ""} ${location ?? ""}\n`;
    nextSub++;
  });
  return { type: "matched", text, nextSubItemIndex: nextSub };
};

const outlet: Matcher = (ctx) => {
  const { d, rawDetail, quantity, buildingIndex, subItemIndex } = ctx;
  if (!d.includes("outlet") || !(d.includes("lan") || d.includes("โทรศัพท์"))) return null;

  const qty = Number(quantity ?? 1);
  const raw = String(rawDetail).toLowerCase();
  const isTel =
    raw.includes("โทรศัพท์") ||
    raw.includes("เบอร์โทร") ||
    raw.includes("สำหรับโทรศัพท์") ||
    raw.includes("tel") ||
    raw.includes("telephone") ||
    raw.includes("phone");

  const outletType = isTel ? "สำหรับโทรศัพท์" : "LAN";
  const outletPrefix = isTel ? "T" : "L";
  const buildingNum = buildingIndex - 1;

  let text = `${buildingNum}.${subItemIndex} ติดตั้งสาย UTP CAT-6 Indoor แบบเหมาจุดรวมของ พร้อมติดตั้ง Outlet ${outletType} (เดินร้อยท่อ PVC สีขาว)\n`;

  // Labels restart at 01 in every building: L01, L02, ... (T01 for telephone).
  let subSubItemIndex = 1;
  for (let i = 0; i < qty; i++) {
    const label = `${outletPrefix}${String(i + 1).padStart(2, "0")}`;
    text += `${buildingNum}.${subItemIndex}.${subSubItemIndex} ติดตั้ง Outlet ${outletType} (${label})\n`;
    subSubItemIndex++;
  }

  return { type: "matched", text, nextSubItemIndex: subItemIndex + 1 };
};

const installLine = (ctx: MatcherContext, suffix = ""): string => {
  const detail = String(ctx.rawDetail ?? "").replace(/\s+/g, " ").trim();
  const prefix = /^(งาน|ติดตั้ง)/.test(detail) ? "" : "ติดตั้ง";
  return `${ctx.buildingIndex - 1}.${ctx.subItemIndex} ${prefix}${detail}${suffix}\n`;
};

export const isRackDetail = (d: string): boolean =>
  d.includes("rack") &&
  d.includes("ตู้") &&
  !d.includes("mount") &&
  !d.includes("odf") &&
  !d.includes("drawer") &&
  !d.includes("switch");

// Cabinet rows have no inventory device, so the line is built from the
// estimate text. A "Ground ของตู้ Rack" row in the same building is folded in.
const rack: Matcher = (ctx) => {
  if (!isRackDetail(ctx.d)) return null;
  const hasGround = ctx.siblingDetails.some((s) => s.includes("ground"));
  const text = installLine(ctx, hasGround ? " พร้อมระบบ Ground ของตู้ Rack" : "");
  return { type: "matched", text, nextSubItemIndex: ctx.subItemIndex + 1 };
};

const kbss: Matcher = (ctx) => {
  if (!ctx.d.includes("kbss")) return null;
  return { type: "matched", text: installLine(ctx), nextSubItemIndex: ctx.subItemIndex + 1 };
};

const skipRules: Matcher = (ctx) => {
  const { d } = ctx;
  if (
    !d ||
    d.includes("ground") ||
    (d.includes("sfp") && d.includes("module")) ||
    (d.includes("patch") && d.includes("cord")) ||
    (d.includes("rack") && d.includes("mount")) ||
    d.includes("ระบบไฟฟ้า") ||
    (d.includes("utp") && d.includes("access point")) ||
    (d.includes("รางไฟ") && d.includes("outlet"))
  ) {
    return { type: "ignore" };
  }
  return null;
};

// Order matters — first non-null wins.
// apWithCableSkip must precede accessPoint. outlet must be last before skipRules.
export const matchers: Matcher[] = [
  apWithCableSkip,
  router,
  switchMatcher,
  accessPoint,
  controller,
  injector,
  ipPhone,
  stabilizer,
  ups,
  ipCamera,
  nvr,
  rack,
  kbss,
  outlet,
  skipRules,
];

// Rows that skipRules drops on purpose — listed in the web check panel so the
// user can see what is not in the report.
export const isSkippedDetail = (d: string): boolean => skipRules({ d } as MatcherContext) !== null;

export const runMatchers = (ctx: MatcherContext): MatcherOutcome => {
  for (const m of matchers) {
    const out = m(ctx);
    if (out !== null) return out;
  }
  return null;
};
