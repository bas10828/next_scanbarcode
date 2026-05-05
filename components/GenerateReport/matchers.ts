import type { Matcher, MatcherContext, MatcherOutcome } from "./types";
import { collapseSpaces, normalize } from "./reportUtils";

const accessPoint: Matcher = (ctx) => {
  const { d, currentBuilding, inventoryData, buildingIndex, subItemIndex } = ctx;
  const isAP =
    d.includes("access point") ||
    d.includes("accesspoint") ||
    d.includes("acess point") ||
    d.includes("acesspoint") ||
    d.includes("wifi");
  if (!isAP) return null;

  const dNormalized = collapseSpaces(d);
  const buildingNorm = normalize(currentBuilding);

  const aps = inventoryData
    .slice(1)
    .filter(([, deviceType, , model, , , , , location]) => {
      if (!model) return false;
      const type = normalize(deviceType);
      const loc = normalize(location);
      const modelNorm = normalize(model);
      return (
        type.includes("accesspoint") &&
        loc.includes(buildingNorm) &&
        dNormalized.includes(modelNorm)
      );
    });

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
  const { d, currentBuilding, inventoryData, buildingIndex, subItemIndex } = ctx;
  const isController =
    (d.includes("controller") ||
      d.includes("oc200") ||
      d.includes("oc220") ||
      d.includes("oc300")) &&
    !d.includes("switch") &&
    !d.includes("access point") &&
    !d.includes("router");
  if (!isController) return null;

  const dNormalized = collapseSpaces(d);
  const buildingNorm = normalize(currentBuilding);

  const controllers = inventoryData.filter(([, deviceType, , model, , , , , location]) => {
    if (!model) return false;
    const type = normalize(deviceType);
    const loc = normalize(location);
    const modelNorm = normalize(model);
    return (
      (type.includes("controller") || type.includes("omada")) &&
      loc.includes(buildingNorm) &&
      dNormalized.includes(modelNorm)
    );
  });

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

const switchMatcher: Matcher = (ctx) => {
  const { d, currentBuilding, inventoryData, buildingIndex, subItemIndex } = ctx;
  if (!d.includes("switch")) return null;

  const dNormalized = collapseSpaces(d);
  const buildingNorm = normalize(currentBuilding);

  const switches = inventoryData.slice(1).filter((row) => {
    const [, deviceType, , model, , , , , location] = row;
    if (!model) return false;
    const typeNorm = normalize(deviceType);
    const locNorm = normalize(location);
    const modelNorm = normalize(model);
    return (
      typeNorm.includes("switch") &&
      locNorm.includes(buildingNorm) &&
      dNormalized.includes(modelNorm)
    );
  });

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
  const { d, currentBuilding, inventoryData, buildingIndex, subItemIndex } = ctx;
  if (
    !d.includes("ip phone") &&
    !d.includes("ipphone") &&
    !d.includes("telephone")
  )
    return null;

  const dNormalized = collapseSpaces(d);
  const buildingNorm = normalize(currentBuilding);

  const phones = inventoryData.slice(1).filter((row) => {
    const [, deviceType, , model, , , , , location] = row;
    if (!model) return false;
    const typeNorm = normalize(deviceType);
    const locNorm = normalize(location);
    const modelNorm = normalize(model);
    const matchType =
      typeNorm.includes("phone") ||
      typeNorm.includes("ipphone") ||
      typeNorm.includes("telephone");
    return matchType && locNorm.includes(buildingNorm) && dNormalized.includes(modelNorm);
  });

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
  const { d, currentBuilding, inventoryData, buildingIndex, subItemIndex } = ctx;
  if (!d.includes("stabilizer")) return null;

  const stabilizers = inventoryData.filter(
    ([, deviceType, , , , , , , location]) =>
      deviceType &&
      String(deviceType).toLowerCase() === "stabilizer" &&
      location &&
      String(location).includes(String(currentBuilding)),
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
  const { d, currentBuilding, inventoryData, buildingIndex, subItemIndex } = ctx;
  if (!d.includes("router")) return null;

  const routers = inventoryData.filter(
    ([, deviceType, , , , , , , location]) =>
      deviceType &&
      String(deviceType).toLowerCase().includes("router") &&
      location &&
      String(location).includes(String(currentBuilding)),
  );

  if (routers.length === 0) return { type: "category-no-inv" };

  const dNormalized = collapseSpaces(d);
  let text = "";
  let subSubItemIndex = 1;
  routers.forEach(([, , brand, model, serialNumber, , deviceName, , location]) => {
    if (!model) return;
    const modelNormalized = collapseSpaces(model);
    if (dNormalized.includes(modelNormalized)) {
      text += `${buildingIndex - 1}.${subItemIndex}.${subSubItemIndex} ติดตั้ง Router ${
        brand ?? ""
      } ${model ?? ""} (${deviceName ?? ""}) S/N: ${serialNumber ?? ""} ${location ?? ""}\n`;
      subSubItemIndex++;
    }
  });

  if (subSubItemIndex === 1) return { type: "category-no-inv" };
  return { type: "matched", text, nextSubItemIndex: subItemIndex + 1 };
};

const ups: Matcher = (ctx) => {
  const { d, rawDetail, currentBuilding, inventoryData, buildingIndex, subItemIndex } = ctx;
  if (!d.toLowerCase().includes("ups")) return null;

  const upsList = inventoryData.filter(
    ([, deviceType, , model, , , , , location]) => {
      if (!model) return false;
      const type = String(deviceType ?? "").toLowerCase().trim();
      const loc = collapseSpaces(location);
      const currentLoc = collapseSpaces(currentBuilding);
      const modelNormalized = collapseSpaces(model);
      const detailNormalized = collapseSpaces(rawDetail);
      return (
        type.includes("ups") &&
        loc.includes(currentLoc) &&
        detailNormalized.includes(modelNormalized)
      );
    },
  );

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
  const { d, currentBuilding, inventoryData, buildingIndex, subItemIndex } = ctx;
  if (!(d.toLowerCase().includes("ip") && d.toLowerCase().includes("camera"))) return null;

  const ipCameras = inventoryData.filter(
    ([, deviceType, , , , , , , location]) =>
      deviceType &&
      String(deviceType).toLowerCase().includes("ip camera") &&
      location &&
      String(location).includes(String(currentBuilding)),
  );

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
  const { d, currentBuilding, inventoryData, buildingIndex, subItemIndex } = ctx;
  if (!d.toLowerCase().includes("nvr")) return null;

  const nvrs = inventoryData.filter(
    ([, deviceType, , , , , , , location]) => {
      const type = String(deviceType ?? "").toLowerCase();
      const loc = collapseSpaces(location);
      const currentLoc = collapseSpaces(currentBuilding);
      return type.includes("nvr") && loc.includes(currentLoc);
    },
  );

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
  const outletLabel = isTel ? "TEL" : "LAN";

  let text = `${buildingIndex - 1}.${subItemIndex} ติดตั้งสาย UTP CAT-6 Indoor แบบเหมาจุดรวมของ พร้อมติดตั้ง Outlet ${outletType} (เดินร้อยท่อ PVC สีขาว)\n`;

  let subSubItemIndex = 1;
  for (let i = 0; i < qty; i++) {
    text += `${buildingIndex - 1}.${subItemIndex}.${subSubItemIndex} ติดตั้ง Outlet ${outletType} (${outletLabel}${
      i + 1
    })\n`;
    subSubItemIndex++;
  }

  return { type: "matched", text, nextSubItemIndex: subItemIndex + 1 };
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

// Order matters — first non-null wins. Mirrors the original if/else chain.
export const matchers: Matcher[] = [
  accessPoint,
  apWithCableSkip,
  controller,
  switchMatcher,
  ipPhone,
  stabilizer,
  router,
  ups,
  ipCamera,
  nvr,
  outlet,
  skipRules,
];

export const runMatchers = (ctx: MatcherContext): MatcherOutcome => {
  for (const m of matchers) {
    const out = m(ctx);
    if (out !== null) return out;
  }
  return null;
};
