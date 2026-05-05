// Decode every barcode (1D + 2D) in a single image using ZXing.
//
// ZXing's MultiFormatReader returns ONE result per call. To find multiple
// barcodes per image we run multiple "passes", each with mask-and-retry:
//   Pass 1: original image + HybridBinarizer             (handles most cases)
//   Pass 2: color-inverted image + HybridBinarizer        (white-on-dark labels)
//   Pass 3: contrast-enhanced image + HybridBinarizer     (faded/low-contrast prints, e.g. Unifi plastic labels)
//   Pass 4: original image + GlobalHistogramBinarizer     (fallback if previous passes found little)
//   Pass 5: tiled inverted (4 overlapping quadrants)      (small white-on-dark 1D barcodes, e.g. TP-Link Omada)
//   Pass 6: tiled original                                (small dark-on-light 1D barcodes)
//
// Each pass clones the base canvas so masks from prior passes don't leak into later ones.
// Tiled passes split the image into 4 overlapping quadrants — small barcodes that get
// drowned out in a large photo gain relative size in each tile, making them findable.
// Format-aware mask padding: 1D barcodes only have 2 result points (start/end of one
// scan line), so the mask Y is sized from the inter-point distance, not just the points.

import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  MultiFormatReader,
  type Result,
} from "@zxing/library";
import { HTMLCanvasElementLuminanceSource } from "@zxing/browser";

const FORMATS: BarcodeFormat[] = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.ITF,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.PDF_417,
  BarcodeFormat.AZTEC,
];

const ONE_D_FORMATS = new Set<BarcodeFormat>([
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.ITF,
]);

const MAX_BARCODES_PER_PASS = 8;

type BinarizerKind = "hybrid" | "global";

const buildHints = (): Map<DecodeHintType, unknown> => {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.TRY_HARDER, true);
  hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS);
  return hints;
};

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${file.name}`));
    };
    img.src = url;
  });

const cloneCanvas = (src: HTMLCanvasElement): HTMLCanvasElement => {
  const dst = document.createElement("canvas");
  dst.width = src.width;
  dst.height = src.height;
  const ctx = dst.getContext("2d");
  if (ctx) ctx.drawImage(src, 0, 0);
  return dst;
};

const invertCanvas = (canvas: HTMLCanvasElement): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
  ctx.putImageData(imageData, 0, 0);
};

// Boost contrast + slight brightness lift via canvas filter — applied during a redraw
// so subsequent reads see crisper edges. Helps QR/barcode prints on plastic
// (e.g. Unifi APs) where the ink fades or has low contrast vs background.
const enhanceContrast = (src: HTMLCanvasElement): HTMLCanvasElement => {
  const dst = document.createElement("canvas");
  dst.width = src.width;
  dst.height = src.height;
  const ctx = dst.getContext("2d");
  if (!ctx) return src;
  ctx.filter = "contrast(150%) brightness(105%) saturate(0%)";
  ctx.drawImage(src, 0, 0);
  return dst;
};

type MaskBox = { minX: number; maxX: number; minY: number; maxY: number };

const getMaskBox = (
  result: Result,
  width: number,
  height: number,
): MaskBox | null => {
  const points = result.getResultPoints();
  if (!points || points.length < 2) return null;
  const xs = points.map((p) => p.getX());
  const ys = points.map((p) => p.getY());
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const isOneD = ONE_D_FORMATS.has(result.getBarcodeFormat());
  let padX = 30;
  let padY = 30;
  if (isOneD) {
    // 1D result points sit on a single horizontal scan line in the middle of the
    // barcode. Use inter-point distance to estimate the bar height (~25% of width).
    const dist = Math.hypot(maxX - minX, maxY - minY);
    padY = Math.max(50, dist * 0.25);
    padX = Math.max(30, dist * 0.05);
  }
  return {
    minX: Math.max(0, minX - padX),
    maxX: Math.min(width, maxX + padX),
    minY: Math.max(0, minY - padY),
    maxY: Math.min(height, maxY + padY),
  };
};

const buildBitmap = (
  canvas: HTMLCanvasElement,
  binarizer: BinarizerKind,
): BinaryBitmap => {
  const luminance = new HTMLCanvasElementLuminanceSource(canvas);
  const bin =
    binarizer === "hybrid"
      ? new HybridBinarizer(luminance)
      : new GlobalHistogramBinarizer(luminance);
  return new BinaryBitmap(bin);
};

const runPass = (
  canvas: HTMLCanvasElement,
  binarizer: BinarizerKind,
  found: Set<string>,
): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const hints = buildHints();
  const reader = new MultiFormatReader();
  reader.setHints(hints);

  for (let i = 0; i < MAX_BARCODES_PER_PASS; i++) {
    let result: Result;
    try {
      result = reader.decode(buildBitmap(canvas, binarizer), hints);
    } catch {
      break; // NotFoundException — done with this pass.
    }
    const text = result.getText().trim();
    if (text) found.add(text);
    const box = getMaskBox(result, canvas.width, canvas.height);
    if (!box || box.maxX <= box.minX || box.maxY <= box.minY) break;
    ctx.fillStyle = "#888888";
    ctx.fillRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
    reader.reset();
  }
};

// Split into 2x2 grid with 30% overlap (each tile = 65% of original on each axis).
// A barcode straddling a quadrant boundary still appears whole in at least one tile.
// Small barcodes (e.g. TP-Link Omada SN/MAC, ~5% of image width) gain ~50% relative
// size in a tile, lifting them above ZXing's localization noise floor.
const runTiledPass = (
  base: HTMLCanvasElement,
  binarizer: BinarizerKind,
  found: Set<string>,
  invert: boolean,
): void => {
  const overlap = 0.3;
  const tileW = Math.floor(base.width * (0.5 + overlap / 2));
  const tileH = Math.floor(base.height * (0.5 + overlap / 2));
  const startX = base.width - tileW;
  const startY = base.height - tileH;
  const positions: Array<[number, number]> = [
    [0, 0],
    [startX, 0],
    [0, startY],
    [startX, startY],
  ];
  for (const [x, y] of positions) {
    const tile = document.createElement("canvas");
    tile.width = tileW;
    tile.height = tileH;
    const tileCtx = tile.getContext("2d");
    if (!tileCtx) continue;
    tileCtx.drawImage(base, x, y, tileW, tileH, 0, 0, tileW, tileH);
    if (invert) invertCanvas(tile);
    runPass(tile, binarizer, found);
  }
};

export const decodeAllBarcodes = async (file: File): Promise<string[]> => {
  const img = await loadImage(file);
  const base = document.createElement("canvas");
  base.width = img.naturalWidth;
  base.height = img.naturalHeight;
  const baseCtx = base.getContext("2d");
  if (!baseCtx) return [];
  baseCtx.drawImage(img, 0, 0);

  const found = new Set<string>();

  // Pass 1: original orientation, HybridBinarizer (best for typical photos).
  runPass(cloneCanvas(base), "hybrid", found);

  // Pass 2: inverted (white-on-dark device labels like TP-Link Omada).
  const inverted = cloneCanvas(base);
  invertCanvas(inverted);
  runPass(inverted, "hybrid", found);

  // Pass 3: contrast-enhanced (faded plastic prints, e.g. Unifi APs).
  runPass(enhanceContrast(base), "hybrid", found);

  // Pass 4: GlobalHistogramBinarizer fallback if previous passes found little.
  if (found.size < 2) {
    runPass(cloneCanvas(base), "global", found);
  }

  // Tiled passes — only run on large enough images and only if we still seem to be
  // missing barcodes. Each tiled pass is ~4x the cost of a normal pass.
  const isLargeImage = Math.min(base.width, base.height) >= 1200;
  if (isLargeImage && found.size < 3) {
    // Tiled inverted — small white-on-dark 1D barcodes (TP-Link Omada SN/MAC).
    runTiledPass(base, "hybrid", found, true);
  }
  if (isLargeImage && found.size < 3) {
    // Tiled original — small dark-on-light 1D barcodes (e.g. Dahua label barcodes).
    runTiledPass(base, "hybrid", found, false);
  }

  return Array.from(found);
};
