import { identifyBarcodes } from "../AutoScan/identifyBarcodes";

export type ParsedBarcode = {
  serial: string;
  mac: string;
  mac_: string;
  model: string;
};

export type Brand =
  | "auto"
  | "unifi"
  | "reyee"
  | "tp-link"
  | "vigi"
  | "hikvision"
  | "unv"
  | "yealink"
  | "mikrotik"
  | "dahua"
  | "cleanline"
  | "cisco";

const EMPTY: ParsedBarcode = { serial: "", mac: "non", mac_: "", model: "" };

const formatMacAddress = (mac: string): string =>
  mac
    .match(/.{1,2}/g)
    ?.join(":")
    .toUpperCase() || mac;

const parseUnifi = (barcodes: string[]): ParsedBarcode => {
  const data = barcodes[0] ?? "";

  // URL format: https://qr.ui.com/[model]/[type]/[MAC12][...] (e.g. U7 Lite)
  // SN = MAC (Unifi convention) — trailing chars after MAC12 are not the SN.
  const urlMatch = /qr\.ui\.com\/[^/]+\/[^/]+\/([A-F0-9]{12})/i.exec(data);
  if (urlMatch) {
    const mac12 = urlMatch[1].toUpperCase();
    return {
      serial: mac12,
      mac: formatMacAddress(mac12),
      mac_: mac12,
      model: "",
    };
  }

  const macPattern = /\b[A-F0-9]{12}\b/;
  const first12 = data.substring(0, 12);
  if (macPattern.test(first12)) {
    return { serial: first12, mac: formatMacAddress(first12), mac_: first12, model: "" };
  }
  return { ...EMPTY, serial: data.substring(0, 19) };
};

const parseReyee = (barcodes: string[]): ParsedBarcode => {
  const data = barcodes.join(" ");
  const urlPattern = /http:\/\/rj\.link\/e\?s=([^&]+)&d=([^&]+)&m=([A-F0-9]{12})/;
  const urlMatch = urlPattern.exec(data);

  if (urlMatch) {
    return {
      serial: urlMatch[1],
      model: urlMatch[2],
      mac: formatMacAddress(urlMatch[3]),
      mac_: urlMatch[3],
    };
  }

  const snPattern = /(\b(?:CA|G1|ZA|AH)[A-Z0-9]{11}\b)/;
  const macPattern = /\b[A-F0-9]{12}\b/;
  const snMatch = data.match(snPattern);
  const serial = snMatch ? snMatch[0] : "non";

  const macMatches = data.match(macPattern);
  if (macMatches) {
    const found = macMatches.find((m) => m.length === 12);
    return {
      serial,
      model: "",
      mac: found ? formatMacAddress(found) : "non",
      mac_: found || "non",
    };
  }
  return { ...EMPTY, serial };
};

// TP-Link Omada and VIGI labels share the same SN/MAC format and carry up to 3 codes:
//   - 1D barcode with SN ("22" prefix, 13-14 chars total):
//       Omada EAP/ES: "2261559001105"      Omada SG: "225C00MC000572"
//       VIGI cameras: "2261096001111"      (InSight S345 etc., also 13-char "22..." family)
//   - 1D barcode with MAC (raw 12-hex, sometimes formatted XX-XX-XX-XX-XX-XX)
//   - QR code with Device Key (Omada: 5×4 hex groups "1534-B0C5-...")
//                  or Device ID (VIGI: 17 contiguous hex chars "534B0C18BDF16C742")
// Neither Device Key nor Device ID satisfies the MAC patterns below — Device Key has
// dashes that break word boundaries, Device ID's 17-char length exceeds the 12-char MAC.
const parseTpLink = (barcodes: string[]): ParsedBarcode => {
  const data = barcodes.join(" ");
  // SN: "22" + 11-13 alphanum (covers both 13-char and 14-char SN families).
  const snPattern = /\b22[A-Z0-9]{11,13}\b/;
  // MAC: try formatted (XX-XX-XX-XX-XX-XX or XX:XX:XX:XX:XX:XX) first, then raw 12-hex.
  const macFmtPattern = /\b([A-F0-9]{2}[-:]){5}[A-F0-9]{2}\b/i;
  const macRawPattern = /\b[A-F0-9]{12}\b/;

  const snMatch = data.match(snPattern);
  const serial = snMatch ? snMatch[0] : "non";

  const macFmt = data.match(macFmtPattern);
  if (macFmt) {
    const raw = macFmt[0].replace(/[-:]/g, "").toUpperCase();
    return { serial, model: "", mac: formatMacAddress(raw), mac_: raw };
  }
  const macRaw = data.match(macRawPattern);
  if (macRaw) {
    const raw = macRaw[0].toUpperCase();
    return { serial, model: "", mac: formatMacAddress(raw), mac_: raw };
  }
  return { ...EMPTY, serial };
};

const parseHikvision = (barcodes: string[]): ParsedBarcode => {
  const data = barcodes.join(" ");
  const pattern1 = /www\.hik-connect\.com\s+([A-Z0-9]+)\s+([A-Z0-9\-]+)/i;
  const pattern2 = /\{GS\}([A-Z0-9]+)/i;

  const m1 = pattern1.exec(data);
  if (m1) return { ...EMPTY, serial: m1[1], model: m1[2] };

  const m2 = pattern2.exec(data);
  if (m2) return { ...EMPTY, serial: m2[1], model: "" };

  return { ...EMPTY, serial: "non", model: "non" };
};

const parseUnv = (barcodes: string[]): ParsedBarcode => {
  const data = barcodes.join("").trim();
  if (data) {
    return { serial: data, model: "non", mac: "non", mac_: "non" };
  }
  return { ...EMPTY, serial: "non", model: "non" };
};

const parseYealink = (barcodes: string[]): ParsedBarcode => {
  const data = barcodes.join(" ");
  const snPattern = /\b[A-Z0-9]{16}\b/;
  const macPattern = /\b[A-F0-9]{12}\b/g;

  const snMatch = data.match(snPattern);
  const serial = snMatch ? snMatch[0] : "non";

  const macMatches = data.match(macPattern);
  if (macMatches) {
    const found = macMatches.find((m) => m !== "841885104823");
    if (found) {
      return { serial, model: "", mac: formatMacAddress(found), mac_: found };
    }
  }
  return { ...EMPTY, serial };
};

// Brand-agnostic parser using the AutoScan classifier (no model detection).
const parseAuto = (barcodes: string[]): ParsedBarcode => {
  const id = identifyBarcodes(barcodes);
  return { serial: id.serial, mac: id.mac, mac_: id.macRaw, model: "" };
};

// Dahua labels typically have 3 scannable codes:
//   - 1D barcode with raw 12-hex MAC, e.g. "C0395A5843C4" = C0:39:5A:58:43:C4
//   - 1D barcode with 15-char alphanumeric SN, e.g. "7L0AE22PAG1E894"
//   - QR code with model/product info
// NVRs (e.g. DHI-NVR4108HS-4KS2/L) often skip the MAC barcode and have only SN + QR.
const parseDahua = (barcodes: string[]): ParsedBarcode => {
  const data = barcodes.join(" ").toUpperCase();

  // MAC: 12 hex chars. Prefer the candidate with ≥2 letters A-F (a real MAC),
  // not a fluke SN substring of all-hex digits.
  const macCandidates = data.match(/[A-F0-9]{12}/g) ?? [];
  const realMac = macCandidates.find(
    (m) => (m.match(/[A-F]/g) ?? []).length >= 2,
  );
  let mac = "non";
  let mac_ = "";
  if (realMac) {
    mac = formatMacAddress(realMac);
    mac_ = realMac;
  }

  // SN: 15-char alphanumeric (Dahua's standard length). Skip if it's the MAC.
  const snCandidates = data.match(/\b[A-Z0-9]{15}\b/g) ?? [];
  const serial = snCandidates.find((s) => !mac_ || !s.includes(mac_)) ?? "non";

  // Model: optional — pulled from QR/text if a Dahua model code is present.
  const modelMatch = data.match(/DH[A-Z]?-[A-Z]+-[A-Z0-9]+(?:[-/][A-Z0-9]+)*/);
  const model = modelMatch ? modelMatch[0] : "";

  return { serial, mac, mac_, model };
};

// Cleanline UPS labels (e.g. CL-800ICT) carry:
//   - 1D barcode with Serial Number, format "LCL" + 7 digits (e.g. "LCL3800263")
//   - TISI QR code (Thai Industrial Standard certification — not useful for inventory)
// No network interface → MAC is always N/A.
const parseCleanline = (barcodes: string[]): ParsedBarcode => {
  const data = barcodes.join(" ").toUpperCase();
  // LCL prefix + 6 or more digits; no upper limit to handle future model variations.
  const snMatch = data.match(/LCL\d{6,}/);
  return {
    serial: snMatch ? snMatch[0] : "non",
    mac: "non",
    mac_: "",
    model: "",
  };
};

// Mikrotik QR usually encodes the SN only (e.g. "HM40B9W7FN2" or "HM40B9W7FN2/r3").
// Newer products may use a URL like "https://mt.lv/<sn>" — strip the URL prefix.
// MAC addresses on Mikrotik labels are printed text (E01:..., E18:...), not in any
// barcode, so they can't be auto-extracted — leave MAC blank for manual entry.
const parseMikrotik = (barcodes: string[]): ParsedBarcode => {
  const data = barcodes.join(" ").trim();
  const urlMatch = data.match(/https?:\/\/[^\s/]+\/(\S+)/i);
  const serial = urlMatch ? urlMatch[1] : data;
  return {
    serial: serial || "non",
    mac: "non",
    mac_: "",
    model: "",
  };
};

// Cisco labels typically carry 3 barcodes:
//   - 1D barcode: PID/model, format "<2digits>-<5digits>-<2digits> <variant>" e.g. "74-12075-03 C0"
//   - 1D barcode: SN, format 3 uppercase letters (MFR code) + 6 digits + 2 alphanum e.g. "DNI210803Z9"
//   - 1D barcode: MAC, raw 12 hex chars e.g. "C4B9CD2FE557"
// Cisco labels carry 2 scannable barcodes:
//   - 1D barcode: SN, format 3 letters (MFR code) + 6 digits + 2 alphanum e.g. "DNI210803Z9"
//   - 1D barcode: MAC, raw 12 hex chars e.g. "C4B9CD2FE557"
// (PID/model such as "74-12075-03 C0" is printed text only — not in a barcode)
const parseCisco = (barcodes: string[]): ParsedBarcode => {
  const data = barcodes.join(" ").toUpperCase();

  // SN: 3 uppercase letters (manufacturer code) + 6 digits + 2 alphanumeric = 11 chars
  const snMatch = data.match(/\b[A-Z]{3}\d{6}[A-Z0-9]{2}\b/);
  const serial = snMatch ? snMatch[0] : "non";

  // MAC: 12 hex chars — prefer the candidate with ≥2 A-F letters (real MAC, not SN fragment)
  const macCandidates = data.match(/[A-F0-9]{12}/g) ?? [];
  const realMac = macCandidates.find((m) => (m.match(/[A-F]/g) ?? []).length >= 2);

  return {
    serial,
    mac: realMac ? formatMacAddress(realMac) : "non",
    mac_: realMac ?? "",
    model: "",
  };
};

const PARSERS: Record<Brand, (barcodes: string[]) => ParsedBarcode> = {
  auto: parseAuto,
  unifi: parseUnifi,
  reyee: parseReyee,
  "tp-link": parseTpLink,
  vigi: parseTpLink, // VIGI cameras use identical SN/MAC encoding to TP-Link Omada.
  hikvision: parseHikvision,
  unv: parseUnv,
  yealink: parseYealink,
  mikrotik: parseMikrotik,
  dahua: parseDahua,
  cleanline: parseCleanline,
  cisco: parseCisco,
};

export const parseBarcode = (brand: Brand, barcodes: string[]): ParsedBarcode =>
  PARSERS[brand](barcodes);

// Detect brand from scanned barcode content. Returns the most specific match,
// or "auto" when no brand-specific pattern is found.
// Ordered from most-specific (URL/unique prefix) to least-specific (length-based).
export const detectBrand = (barcodes: string[]): Brand => {
  const data = barcodes.join(" ").toUpperCase();

  // URL-based — virtually zero false-positive risk
  if (/RJ\.LINK\//.test(data)) return "reyee";
  if (/HIK-CONNECT\.COM/.test(data) || /\{GS\}[A-Z0-9]/.test(data)) return "hikvision";
  if (/MT\.LV\//.test(data)) return "mikrotik";
  if (/QR\.UI\.COM\//.test(data)) return "unifi";

  // Unique SN prefix / format patterns
  if (/LCL\d{6,}/.test(data)) return "cleanline";
  if (/\b[A-Z]{3}\d{6}[A-Z0-9]{2}\b/.test(data)) return "cisco";
  if (/\b(?:CA|G1|ZA|AH)[A-Z0-9]{11}\b/.test(data)) return "reyee";
  if (/\b22[A-Z0-9]{11,13}\b/.test(data)) return "tp-link";

  // SN length-based (checked after all prefix patterns to avoid early exits)
  if (/\b[A-Z0-9]{16}\b/.test(data)) return "yealink";  // Yealink SN = 16 chars
  if (/\b[A-Z0-9]{15}\b/.test(data)) return "dahua";    // Dahua SN  = 15 chars

  // Unifi: first barcode starts with a 12-hex MAC (may have a short suffix like "-w5LLbT")
  if (/^[0-9A-F]{12}/.test(barcodes[0]?.toUpperCase() ?? "")) return "unifi";

  return "auto";
};

export const BRAND_OPTIONS: { value: Brand; label: string }[] = [
  { value: "auto", label: "Auto-Detect" },
  { value: "reyee", label: "Reyee" },
  { value: "unifi", label: "Unifi" },
  { value: "tp-link", label: "TP-Link" },
  { value: "vigi", label: "TP-Link VIGI" },
  { value: "hikvision", label: "Hikvision" },
  { value: "unv", label: "UNV" },
  { value: "yealink", label: "Yealink" },
  { value: "mikrotik", label: "Mikrotik" },
  { value: "dahua", label: "Dahua" },
  { value: "cleanline", label: "Cleanline" },
  { value: "cisco", label: "Cisco" },
];
