// Barcode decoder backed by zxing-wasm (C++ ZXing compiled to WebAssembly).
//
// Multi-pass strategy (each pass only runs when found.size < 2 after the previous):
//   Pass 1: original file → zxing-wasm (tryHarder/Rotate/Invert/Downscale)
//   Pass 2-4: contrast(200/300/400%) — matte labels, bars~80 grey → 5, silver~185 → 255
//   Pass 5: contrast(800%)           — metallic labels where bars photograph at ~110 grey
//   Pass 6: contrast(10000%)         — binary threshold at midgrey: p<128→0, p>128→255
//   Pass 7: sharpen + contrast(400%) — blurry shots, recovers merged bar edges
//   Pass 8: 4×4 tiled sharpen+contrast(400%) — small barcodes, standard contrast
//   Pass 9: 4×4 tiled + contrast(10000%)     — small barcodes on silver/metallic labels
//
// Math: CSS contrast(X%) maps pixel p → 127 + (p - 127) × X/100, clamped [0,255].
// TP-Link Omada silver labels: bars photograph at ~110-120 grey (metallic substrate
// absorbs less light than matte paper), so contrast(400%) leaves them at ~71-99 grey.
//   contrast(800%):   bars(110)→31, silver(185)→255
//   contrast(10000%): bars(110)→0,  silver(185)→255  — true binary threshold
//
// WASM file is served from /wasm/zxing_reader.wasm (copied from node_modules at install time).

import {
  readBarcodesFromImageFile,
  readBarcodesFromImageData,
  setZXingModuleOverrides,
  type ReaderOptions,
  type ReadResult,
} from "zxing-wasm/reader";

setZXingModuleOverrides({
  locateFile: () => "/wasm/zxing_reader.wasm",
});

const READER_OPTIONS: ReaderOptions = {
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
  maxNumberOfSymbols: 10,
  formats: [
    "QRCode",
    "Code128",
    "Code39",
    "Code93",
    "EAN13",
    "EAN8",
    "UPCA",
    "UPCE",
    "ITF",
    "DataMatrix",
    "PDF417",
    "Aztec",
  ],
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
      reject(new Error(`Failed to load: ${file.name}`));
    };
    img.src = url;
  });

const imageToCanvas = (img: HTMLImageElement): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d")!.drawImage(img, 0, 0);
  return canvas;
};

const applyContrastFilter = (src: HTMLCanvasElement, contrast: number): HTMLCanvasElement => {
  const dst = document.createElement("canvas");
  dst.width = src.width;
  dst.height = src.height;
  const ctx = dst.getContext("2d")!;
  ctx.filter = `contrast(${contrast}%) saturate(0%)`;
  ctx.drawImage(src, 0, 0);
  return dst;
};

// Unsharp mask (3×3 Laplacian sharpening) applied in-place to greyscale ImageData.
// Recovers slightly-blurred barcode bar edges so the binarizer can separate bars from background.
// Kernel: center×(1+amount) − neighbours×(amount/4), clamped to [0,255].
const sharpenImageData = (imageData: ImageData, amount: number = 1.0): void => {
  const { data, width, height } = imageData;
  const orig = new Uint8ClampedArray(data);
  const w4 = width * 4;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const neighbours =
          orig[(i - w4) + c] +
          orig[(i + w4) + c] +
          orig[i - 4 + c] +
          orig[i + 4 + c];
        data[i + c] = Math.max(
          0,
          Math.min(255, Math.round((1 + amount) * orig[i + c] - (amount / 4) * neighbours)),
        );
      }
    }
  }
};

const getImageData = (canvas: HTMLCanvasElement): ImageData =>
  canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);

const getSharpenedImageData = (canvas: HTMLCanvasElement, amount: number = 1.0): ImageData => {
  const id = getImageData(canvas);
  sharpenImageData(id, amount);
  return id;
};

const addFound = (found: Set<string>, results: ReadResult[]): void => {
  for (const r of results) {
    const t = r.text.trim();
    if (t) found.add(t);
  }
};

// Run zxing-wasm on NxN overlapping tiles of a canvas.
// N=4 → 40% tile size — lifts a 6%-wide barcode to ~15% of tile, crossing ZXing's noise floor.
const runTiledZxing = async (
  base: HTMLCanvasElement,
  found: Set<string>,
  gridN: number,
  sharpen: boolean = false,
): Promise<void> => {
  const overlap = 0.3;
  const tileW = Math.floor(base.width * (1 / gridN + overlap / 2));
  const tileH = Math.floor(base.height * (1 / gridN + overlap / 2));

  for (let row = 0; row < gridN; row++) {
    const y =
      gridN === 1
        ? 0
        : Math.floor((row * (base.height - tileH)) / (gridN - 1));
    for (let col = 0; col < gridN; col++) {
      const x =
        gridN === 1
          ? 0
          : Math.floor((col * (base.width - tileW)) / (gridN - 1));

      const tile = document.createElement("canvas");
      tile.width = tileW;
      tile.height = tileH;
      const ctx = tile.getContext("2d");
      if (!ctx) continue;
      ctx.drawImage(base, x, y, tileW, tileH, 0, 0, tileW, tileH);

      const id = sharpen ? getSharpenedImageData(tile) : getImageData(tile);
      addFound(found, await readBarcodesFromImageData(id, READER_OPTIONS));
    }
  }
};

export const decodeAllBarcodes = async (file: File): Promise<string[]> => {
  const found = new Set<string>();

  // Pass 1: original — zxing-wasm handles scale/rotation/invert natively.
  addFound(found, await readBarcodesFromImageFile(file, READER_OPTIONS));

  if (found.size < 2) {
    const img = await loadImage(file);
    const base = imageToCanvas(img);

    // Passes 2-6: escalating contrast. 200-400% for matte labels, 800% and 10000%
    // for silver/metallic labels (TP-Link Omada) where bars photograph at ~110-120 grey.
    // contrast(10000%) acts as a binary threshold: anything < 128 → black, > 128 → white.
    for (const contrast of [200, 300, 400, 800, 10000]) {
      if (found.size >= 2) break;
      addFound(found, await readBarcodesFromImageData(
        getImageData(applyContrastFilter(base, contrast)), READER_OPTIONS));
    }

    if (found.size < 2) {
      // Pass 7: sharpened + contrast(400%) — recovers blurry barcode bar edges.
      addFound(found, await readBarcodesFromImageData(
        getSharpenedImageData(applyContrastFilter(base, 400)), READER_OPTIONS));
    }

    if (found.size < 2) {
      // Pass 8: 4×4 tiled sharpened+contrast(400%) — small barcodes + low contrast.
      await runTiledZxing(applyContrastFilter(base, 400), found, 4, true);
    }

    if (found.size < 2) {
      // Pass 9: 4×4 tiled + binary threshold — small barcodes on silver/metallic labels.
      await runTiledZxing(applyContrastFilter(base, 10000), found, 4, false);
    }
  }

  const out: string[] = [];
  found.forEach((t) => out.push(t));
  return out;
};
