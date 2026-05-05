// Universal barcode → { MAC, S/N } classifier.
// Brand-agnostic: works on any combination of barcodes/QRs found in one image.
//
// Strategy:
//   1. Score every decoded string for "MAC-likeness" (formatted MAC > pure 12-hex > prefix-12-hex).
//   2. Reject obvious false positives (license keys with 4-char dash groups, EAN blacklist, all-zero).
//   3. Best-scoring candidate above threshold = MAC.
//   4. Remaining strings are S/N candidates; score by length, alphanumeric purity, mixed letters/digits.
//   5. Special case: single barcode containing MAC at start (Ubiquiti) → both MAC and S/N from same string.

export type IdentifiedBarcodes = {
  mac: string;        // formatted "AA:BB:CC:DD:EE:FF"
  macRaw: string;     // 12 hex chars, no separators, uppercase
  serial: string;
  raw: string[];      // every decoded string for inspection
};

// Known false-positive 12-hex strings seen on real labels.
const MAC_BLACKLIST = new Set<string>([
  "841885104823", // Yealink EAN/customs code
  "000000000000",
  "FFFFFFFFFFFF",
]);

const formatMac = (raw12: string): string =>
  raw12.match(/.{2}/g)?.join(":").toUpperCase() ?? raw12;

const hexLetterCount = (s: string): number =>
  (s.match(/[A-Fa-f]/g) ?? []).length;

type MacCandidate = { source: string; raw12: string; score: number };

const scoreMac = (s: string): MacCandidate | null => {
  const trimmed = s.trim();

  // Reject license/device-key style: 4+ hex groups separated by - or space, each ≥3 chars.
  // Catches "1A36-60B5-845D-812F-F000" (TP-Link Device Key).
  if (/^[0-9A-Fa-f]{3,}([- ][0-9A-Fa-f]{3,}){2,}$/.test(trimmed)) return null;

  // Format A: standard MAC with separators (highest confidence).
  if (/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(trimmed)) {
    const raw12 = trimmed.replace(/[:-]/g, "").toUpperCase();
    if (MAC_BLACKLIST.has(raw12)) return null;
    return { source: trimmed, raw12, score: 100 };
  }

  // Format B: exactly 12 hex chars, no separator.
  if (/^[0-9A-Fa-f]{12}$/.test(trimmed)) {
    const raw12 = trimmed.toUpperCase();
    if (MAC_BLACKLIST.has(raw12)) return null;
    const letters = hexLetterCount(raw12);
    // All-digit 12-char strings could be EAN — keep but lower score.
    return { source: trimmed, raw12, score: letters >= 2 ? 90 : letters >= 1 ? 70 : 40 };
  }

  // Format C: 12-hex prefix followed by alphanumeric tail (Ubiquiti QR).
  const prefix = trimmed.match(/^([0-9A-Fa-f]{12})([A-Z0-9]+)$/);
  if (prefix) {
    const raw12 = prefix[1].toUpperCase();
    if (MAC_BLACKLIST.has(raw12)) return null;
    const letters = hexLetterCount(raw12);
    return { source: trimmed, raw12, score: letters >= 2 ? 85 : 55 };
  }

  return null;
};

const scoreSerial = (s: string): number => {
  const trimmed = s.trim();
  if (trimmed.length < 4 || trimmed.length > 32) return 0;
  let score = 0;
  // Pure alphanumeric (no separators) — typical barcode S/N format.
  if (/^[A-Za-z0-9]+$/.test(trimmed)) score += 30;
  // Mix of letters and digits — strong S/N signal.
  if (/[A-Za-z]/.test(trimmed) && /[0-9]/.test(trimmed)) score += 20;
  // Sweet spot: 8-20 chars.
  if (trimmed.length >= 8 && trimmed.length <= 20) score += 20;
  // Bonus: starts with digits (common SN convention).
  if (/^\d/.test(trimmed)) score += 5;
  return score;
};

const MAC_SCORE_THRESHOLD = 50;

export const identifyBarcodes = (decoded: string[]): IdentifiedBarcodes => {
  const raw = decoded.map((s) => s.trim()).filter(Boolean);

  // Score every candidate for MAC.
  const macCandidates = raw
    .map((s) => scoreMac(s))
    .filter((c): c is MacCandidate => c !== null && c.score >= MAC_SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  const bestMac = macCandidates[0] ?? null;

  // Special case: single barcode whose MAC is at the start with extra payload (Ubiquiti).
  // Treat the full string as S/N too.
  if (bestMac && raw.length === 1 && bestMac.source.length > 12) {
    return {
      mac: formatMac(bestMac.raw12),
      macRaw: bestMac.raw12,
      serial: bestMac.source,
      raw,
    };
  }

  // S/N = highest-scoring string that isn't the chosen MAC.
  // (Weak MAC candidates that LOST to a stronger one are still eligible — e.g. a
  // 13-digit TP-Link SN scores ~60 as MAC-by-prefix but loses to a real 12-hex MAC
  // with letters at score 90; that SN should still appear in the serial pool.)
  const chosenMacSource = bestMac?.source;
  const serialCandidates = raw
    .filter((s) => s !== chosenMacSource)
    .map((s) => ({ value: s, score: scoreSerial(s) }))
    .sort((a, b) => b.score - a.score || a.value.length - b.value.length);

  const serial = serialCandidates[0]?.value ?? "";

  return {
    mac: bestMac ? formatMac(bestMac.raw12) : "",
    macRaw: bestMac?.raw12 ?? "",
    serial,
    raw,
  };
};
