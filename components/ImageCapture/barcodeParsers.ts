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
  | "injector"
  | "hikvision"
  | "unv"
  | "yealink"
  | "mikrotik"
  | "dahua"
  | "cleanline"
  | "cisco";

const EMPTY: ParsedBarcode = { serial: "", mac: "non", mac_: "", model: "" };

// MAC OUI (first 6 hex chars = IEEE-assigned manufacturer ID) → brand.
// Sourced from the official IEEE registry (https://standards-oui.ieee.org/oui/oui.csv),
// filtered to vendors this app handles. Unlike an SN pattern, OUI is a hard IEEE
// guarantee — used in detectBrand() as a fallback when no SN/URL pattern matches but
// a MAC barcode was scanned. It identifies brand only, never model (see barcodeParsers
// brand-detection notes — model is not derivable from MAC).
const OUI_BRAND: Record<string, Brand> = {
  // unifi (48 OUIs)
  "00156D": "unifi",
  "002722": "unifi",
  "0418D6": "unifi",
  "0CEA14": "unifi",
  "18E829": "unifi",
  "1C0B8B": "unifi",
  "1C6A1B": "unifi",
  "245A4C": "unifi",
  "24A43C": "unifi",
  "28704E": "unifi",
  "2CE5BD": "unifi",
  "44D9E7": "unifi",
  "58D61F": "unifi",
  "602232": "unifi",
  "682E3C": "unifi",
  "687251": "unifi",
  "68D79A": "unifi",
  "6C63F8": "unifi",
  "70A741": "unifi",
  "7483C2": "unifi",
  "74ACB9": "unifi",
  "74F92C": "unifi",
  "74FA29": "unifi",
  "784558": "unifi",
  "788A20": "unifi",
  "802AA8": "unifi",
  "847848": "unifi",
  "8C3066": "unifi",
  "8CEDE1": "unifi",
  "9041B2": "unifi",
  "942A6F": "unifi",
  "9C05D6": "unifi",
  "A4F8FF": "unifi",
  "A89C6C": "unifi",
  "AC8BA9": "unifi",
  "B4FBE4": "unifi",
  "CC35D9": "unifi",
  "D021F9": "unifi",
  "D489C1": "unifi",
  "D8B370": "unifi",
  "D8C262": "unifi",
  "DC9FDB": "unifi",
  "E063DA": "unifi",
  "E43883": "unifi",
  "F09FC2": "unifi",
  "F492BF": "unifi",
  "F4E2C6": "unifi",
  "FCECDA": "unifi",
  // tp-link (265 OUIs) — also covers vigi/injector (same manufacturer)
  "000AEB": "tp-link",
  "001478": "tp-link",
  "0019E0": "tp-link",
  "001D0F": "tp-link",
  "002127": "tp-link",
  "0023CD": "tp-link",
  "002586": "tp-link",
  "002719": "tp-link",
  "003192": "tp-link",
  "005F67": "tp-link",
  "040F66": "tp-link",
  "04C845": "tp-link",
  "04F9F8": "tp-link",
  "081F71": "tp-link",
  "085700": "tp-link",
  "0C4B54": "tp-link",
  "0C722C": "tp-link",
  "0C8063": "tp-link",
  "0C8268": "tp-link",
  "0CEF15": "tp-link",
  "1027F5": "tp-link",
  "105A95": "tp-link",
  "10FEED": "tp-link",
  "147590": "tp-link",
  "148692": "tp-link",
  "14CC20": "tp-link",
  "14CF92": "tp-link",
  "14D864": "tp-link",
  "14E6E4": "tp-link",
  "14EBB6": "tp-link",
  "186945": "tp-link",
  "18A6F7": "tp-link",
  "18D6C7": "tp-link",
  "18F22C": "tp-link",
  "1C3BF3": "tp-link",
  "1C4419": "tp-link",
  "1C61B4": "tp-link",
  "1CFA68": "tp-link",
  "202351": "tp-link",
  "203626": "tp-link",
  "206BE7": "tp-link",
  "20DCE6": "tp-link",
  "20E15D": "tp-link",
  "242FD0": "tp-link",
  "245A5F": "tp-link",
  "246968": "tp-link",
  "282CB2": "tp-link",
  "2887BA": "tp-link",
  "289104": "tp-link",
  "28EE52": "tp-link",
  "2C79BE": "tp-link",
  "306893": "tp-link",
  "30B49E": "tp-link",
  "30B5C2": "tp-link",
  "30DE4B": "tp-link",
  "30FC68": "tp-link",
  "3460F9": "tp-link",
  "349672": "tp-link",
  "34E894": "tp-link",
  "34F716": "tp-link",
  "388345": "tp-link",
  "3C06A7": "tp-link",
  "3C46D8": "tp-link",
  "3C52A1": "tp-link",
  "3C64CF": "tp-link",
  "3C6A48": "tp-link",
  "3C6AD2": "tp-link",
  "3C7895": "tp-link",
  "3C846A": "tp-link",
  "40169F": "tp-link",
  "403F8C": "tp-link",
  "409595": "tp-link",
  "40AE30": "tp-link",
  "40ED00": "tp-link",
  "446690": "tp-link",
  "44B32D": "tp-link",
  "480EEC": "tp-link",
  "482254": "tp-link",
  "485F08": "tp-link",
  "487D2E": "tp-link",
  "48C381": "tp-link",
  "4C10D5": "tp-link",
  "503DD1": "tp-link",
  "503EAA": "tp-link",
  "5091E3": "tp-link",
  "50BD5F": "tp-link",
  "50C7BF": "tp-link",
  "50D4F7": "tp-link",
  "50FA84": "tp-link",
  "547595": "tp-link",
  "54A703": "tp-link",
  "54AF97": "tp-link",
  "54C80F": "tp-link",
  "54D299": "tp-link",
  "54E6FC": "tp-link",
  "58044F": "tp-link",
  "584120": "tp-link",
  "58D812": "tp-link",
  "5C628B": "tp-link",
  "5C63BF": "tp-link",
  "5C899A": "tp-link",
  "5CA64F": "tp-link",
  "5CA6E6": "tp-link",
  "5CE931": "tp-link",
  "60156F": "tp-link",
  "60292B": "tp-link",
  "6032B1": "tp-link",
  "603A7C": "tp-link",
  "6083E7": "tp-link",
  "60A3E3": "tp-link",
  "60A4B7": "tp-link",
  "60E327": "tp-link",
  "645601": "tp-link",
  "6466B3": "tp-link",
  "646E97": "tp-link",
  "647002": "tp-link",
  "687724": "tp-link",
  "687FF0": "tp-link",
  "68DDB7": "tp-link",
  "68FF7B": "tp-link",
  "6C4CBC": "tp-link",
  "6C5AB0": "tp-link",
  "6CB158": "tp-link",
  "6CE873": "tp-link",
  "704F57": "tp-link",
  "7405A5": "tp-link",
  "743989": "tp-link",
  "74DA88": "tp-link",
  "74EA3A": "tp-link",
  "74FECE": "tp-link",
  "782051": "tp-link",
  "7844FD": "tp-link",
  "78605B": "tp-link",
  "788CB5": "tp-link",
  "78A106": "tp-link",
  "78C05A": "tp-link",
  "7C8BCA": "tp-link",
  "7CB59B": "tp-link",
  "7CC2C6": "tp-link",
  "7CF17E": "tp-link",
  "803C04": "tp-link",
  "808917": "tp-link",
  "808F1D": "tp-link",
  "80AE54": "tp-link",
  "80EA07": "tp-link",
  "8416F9": "tp-link",
  "84B890": "tp-link",
  "84D81B": "tp-link",
  "882593": "tp-link",
  "889986": "tp-link",
  "8C210A": "tp-link",
  "8C86DD": "tp-link",
  "8C902D": "tp-link",
  "8CA6DF": "tp-link",
  "901F94": "tp-link",
  "909A4A": "tp-link",
  "90AE1B": "tp-link",
  "90F652": "tp-link",
  "940C6D": "tp-link",
  "94D9B3": "tp-link",
  "94EF50": "tp-link",
  "98038E": "tp-link",
  "98254A": "tp-link",
  "984827": "tp-link",
  "9897CC": "tp-link",
  "98BA5F": "tp-link",
  "98DAC4": "tp-link",
  "98DED0": "tp-link",
  "9C216A": "tp-link",
  "9C4782": "tp-link",
  "9C5322": "tp-link",
  "9CA2F4": "tp-link",
  "9CA615": "tp-link",
  "A0F3C1": "tp-link",
  "A41A3A": "tp-link",
  "A42BB0": "tp-link",
  "A8154D": "tp-link",
  "A82948": "tp-link",
  "A829DC": "tp-link",
  "A842A1": "tp-link",
  "A8574E": "tp-link",
  "A86E84": "tp-link",
  "AC15A2": "tp-link",
  "AC84C6": "tp-link",
  "ACA7F1": "tp-link",
  "B01921": "tp-link",
  "B0487A": "tp-link",
  "B04E26": "tp-link",
  "B09575": "tp-link",
  "B0958E": "tp-link",
  "B0A7B9": "tp-link",
  "B0BE76": "tp-link",
  "B45BD1": "tp-link",
  "B4B024": "tp-link",
  "B4C0C3": "tp-link",
  "B8F883": "tp-link",
  "B8FBB3": "tp-link",
  "BC071D": "tp-link",
  "BC4699": "tp-link",
  "BCD177": "tp-link",
  "C006C3": "tp-link",
  "C025E9": "tp-link",
  "C03A55": "tp-link",
  "C04A00": "tp-link",
  "C06118": "tp-link",
  "C0C9E3": "tp-link",
  "C0E42D": "tp-link",
  "C46E1F": "tp-link",
  "C47154": "tp-link",
  "C4E984": "tp-link",
  "CC08FB": "tp-link",
  "CC32E5": "tp-link",
  "CC3429": "tp-link",
  "CC68B6": "tp-link",
  "CCBABD": "tp-link",
  "D03745": "tp-link",
  "D076E7": "tp-link",
  "D0C7C0": "tp-link",
  "D4016D": "tp-link",
  "D46E0E": "tp-link",
  "D4D6DF": "tp-link",
  "D807B6": "tp-link",
  "D80D17": "tp-link",
  "D8150D": "tp-link",
  "D84489": "tp-link",
  "D84732": "tp-link",
  "D85D4C": "tp-link",
  "D8F12E": "tp-link",
  "DC0077": "tp-link",
  "DC6279": "tp-link",
  "DCFE18": "tp-link",
  "E005C5": "tp-link",
  "E0280A": "tp-link",
  "E0D362": "tp-link",
  "E443CF": "tp-link",
  "E4C32A": "tp-link",
  "E4D332": "tp-link",
  "E4FAC4": "tp-link",
  "E848B8": "tp-link",
  "E894F6": "tp-link",
  "E8DE27": "tp-link",
  "EC086B": "tp-link",
  "EC172F": "tp-link",
  "EC26CA": "tp-link",
  "EC6073": "tp-link",
  "EC750C": "tp-link",
  "EC888F": "tp-link",
  "ECB931": "tp-link",
  "F0090D": "tp-link",
  "F0A731": "tp-link",
  "F0F336": "tp-link",
  "F42A7D": "tp-link",
  "F46D2F": "tp-link",
  "F483CD": "tp-link",
  "F4848D": "tp-link",
  "F4EC38": "tp-link",
  "F4F26D": "tp-link",
  "F4F50B": "tp-link",
  "F81A67": "tp-link",
  "F86FB0": "tp-link",
  "F88C21": "tp-link",
  "F8C903": "tp-link",
  "F8CE21": "tp-link",
  "F8D111": "tp-link",
  "FCD733": "tp-link",
  // dahua (33 OUIs)
  "08EDED": "dahua",
  "14A78B": "dahua",
  "202C05": "dahua",
  "24526A": "dahua",
  "30DDAA": "dahua",
  "38AF29": "dahua",
  "3CE36B": "dahua",
  "3CEF8C": "dahua",
  "407AA4": "dahua",
  "4C11BF": "dahua",
  "4C99E8": "dahua",
  "5CF51A": "dahua",
  "64FD29": "dahua",
  "6C1C71": "dahua",
  "74C929": "dahua",
  "8CE9B4": "dahua",
  "9002A9": "dahua",
  "98F9CC": "dahua",
  "9C1463": "dahua",
  "A0BD1D": "dahua",
  "A8CA87": "dahua",
  "B44C3B": "dahua",
  "BC325F": "dahua",
  "C0395A": "dahua",
  "C4AAC4": "dahua",
  "D4430E": "dahua",
  "E02EFE": "dahua",
  "E0508B": "dahua",
  "E4246C": "dahua",
  "F4B1C2": "dahua",
  "F8CE07": "dahua",
  "FC5F49": "dahua",
  "FCB69D": "dahua",
  // hikvision (84 OUIs)
  "00BC99": "hikvision",
  "040312": "hikvision",
  "04EECD": "hikvision",
  "083BC1": "hikvision",
  "085411": "hikvision",
  "08A189": "hikvision",
  "08CC81": "hikvision",
  "0C75D2": "hikvision",
  "1012FB": "hikvision",
  "1868CB": "hikvision",
  "188025": "hikvision",
  "240F9B": "hikvision",
  "2428FD": "hikvision",
  "2432AE": "hikvision",
  "244845": "hikvision",
  "2857BE": "hikvision",
  "2CA59C": "hikvision",
  "340962": "hikvision",
  "3C1BF8": "hikvision",
  "40ACBF": "hikvision",
  "40B570": "hikvision",
  "4419B6": "hikvision",
  "4447CC": "hikvision",
  "44A642": "hikvision",
  "48785B": "hikvision",
  "4C1F86": "hikvision",
  "4C62DF": "hikvision",
  "4CBD8F": "hikvision",
  "4CF5DC": "hikvision",
  "50E538": "hikvision",
  "548C81": "hikvision",
  "54C415": "hikvision",
  "5803FB": "hikvision",
  "5850ED": "hikvision",
  "5C345B": "hikvision",
  "64DB8B": "hikvision",
  "686DBC": "hikvision",
  "743FC2": "hikvision",
  "80489F": "hikvision",
  "807C62": "hikvision",
  "80BEAF": "hikvision",
  "80F5AE": "hikvision",
  "849459": "hikvision",
  "849A40": "hikvision",
  "88DE39": "hikvision",
  "8C22D2": "hikvision",
  "8CE748": "hikvision",
  "94E1AC": "hikvision",
  "988B0A": "hikvision",
  "989DE5": "hikvision",
  "98DF82": "hikvision",
  "98F112": "hikvision",
  "A0FF0C": "hikvision",
  "A41437": "hikvision",
  "A42902": "hikvision",
  "A44BD9": "hikvision",
  "A4A459": "hikvision",
  "A4D5C2": "hikvision",
  "ACB92F": "hikvision",
  "ACCB51": "hikvision",
  "B0FF0D": "hikvision",
  "B4A382": "hikvision",
  "BC5E33": "hikvision",
  "BC9B5E": "hikvision",
  "BCAD28": "hikvision",
  "BCBAC2": "hikvision",
  "C0517E": "hikvision",
  "C056E3": "hikvision",
  "C06DED": "hikvision",
  "C42F90": "hikvision",
  "C8A702": "hikvision",
  "CC13F3": "hikvision",
  "D4E853": "hikvision",
  "DC07F8": "hikvision",
  "DCD26A": "hikvision",
  "E0BAAD": "hikvision",
  "E0CA3C": "hikvision",
  "E0DF13": "hikvision",
  "E4D58B": "hikvision",
  "E8A0ED": "hikvision",
  "ECA971": "hikvision",
  "ECC89C": "hikvision",
  "F84DFC": "hikvision",
  "FC9FFD": "hikvision",
  // reyee (34 OUIs)
  "0011AD": "reyee",
  "00749C": "reyee",
  "105F02": "reyee",
  "10823D": "reyee",
  "14144B": "reyee",
  "28D0F5": "reyee",
  "300D9E": "reyee",
  "4881D4": "reyee",
  "4C4968": "reyee",
  "541651": "reyee",
  "5423E3": "reyee",
  "58696C": "reyee",
  "58B4BB": "reyee",
  "7042D3": "reyee",
  "70856C": "reyee",
  "7085C4": "reyee",
  "7408AA": "reyee",
  "78ECB5": "reyee",
  "800588": "reyee",
  "8CDD30": "reyee",
  "984A6B": "reyee",
  "9C2BA6": "reyee",
  "9CCE88": "reyee",
  "C0A476": "reyee",
  "C0B8E6": "reyee",
  "C470AB": "reyee",
  "C4B25B": "reyee",
  "C8CD55": "reyee",
  "D43127": "reyee",
  "D8332A": "reyee",
  "E05D54": "reyee",
  "ECB970": "reyee",
  "F0748D": "reyee",
  "FC599F": "reyee",
  // yealink (11 OUIs)
  "001565": "yealink",
  "249AD8": "yealink",
  "3497D7": "yealink",
  "44DBD2": "yealink",
  "644F56": "yealink",
  "805E0C": "yealink",
  "805EC0": "yealink",
  "B061A9": "yealink",
  "C4FC22": "yealink",
  "EC1DA9": "yealink",
  "F01653": "yealink",
  // mikrotik (22 OUIs)
  "000C42": "mikrotik",
  "04F41C": "mikrotik",
  "085531": "mikrotik",
  "18FD74": "mikrotik",
  "2CC81B": "mikrotik",
  "38327A": "mikrotik",
  "488F5A": "mikrotik",
  "48A98A": "mikrotik",
  "4C5E0C": "mikrotik",
  "64D154": "mikrotik",
  "6C3B6B": "mikrotik",
  "744D28": "mikrotik",
  "789A18": "mikrotik",
  "B869F4": "mikrotik",
  "C4AD34": "mikrotik",
  "CC2DE0": "mikrotik",
  "D0EA11": "mikrotik",
  "D401C3": "mikrotik",
  "D4CA6D": "mikrotik",
  "DC2C6E": "mikrotik",
  "E48D8C": "mikrotik",
  "F41E57": "mikrotik",
};

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

// TP-Link PoE Injector labels carry 1D barcode with SN only.
// SN format: "42" prefix + 11 alphanumeric chars = 13 chars total (e.g. "425C309002611").
// No network interface on the injector itself → MAC is always N/A.
const parseInjector = (barcodes: string[]): ParsedBarcode => {
  const data = barcodes.join(" ").toUpperCase();
  const snMatch = data.match(/\b42[A-Z0-9]{11}\b/);
  return {
    serial: snMatch ? snMatch[0] : "non",
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
  injector: parseInjector,
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
  if (/\b42[A-Z0-9]{11}\b/.test(data)) return "injector";
  if (/\b22[A-Z0-9]{11,13}\b/.test(data)) return "tp-link";

  // MAC OUI (manufacturer ID, IEEE-registered — more reliable than a length guess)
  // checked here: after the URL/unique-prefix patterns above (those are as good or
  // better, being human-designed unique formats), but before the weaker length-based
  // guesses below (plain digit-count has real collision risk between brands).
  const macCandidates = data.match(/\b[A-F0-9]{12}\b/g) ?? [];
  // Prefer candidates that look like a real MAC (≥2 A-F letters) over an
  // incidental all-hex-looking SN substring, same heuristic used in parseDahua/parseCisco.
  const byMacLikelihood = [...macCandidates].sort(
    (a, b) => (b.match(/[A-F]/g) ?? []).length - (a.match(/[A-F]/g) ?? []).length,
  );
  for (const mac of byMacLikelihood) {
    const brand = OUI_BRAND[mac.substring(0, 6)];
    if (brand) return brand;
  }

  // SN length-based (checked after all prefix/MAC patterns to avoid early exits)
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
  { value: "injector", label: "TP-Link Injector" },
  { value: "hikvision", label: "Hikvision" },
  { value: "unv", label: "UNV" },
  { value: "yealink", label: "Yealink" },
  { value: "mikrotik", label: "Mikrotik" },
  { value: "dahua", label: "Dahua" },
  { value: "cleanline", label: "Cleanline" },
  { value: "cisco", label: "Cisco" },
];
