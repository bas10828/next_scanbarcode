// Barcode decoder backed by zxing-wasm (C++ ZXing compiled to WebAssembly).
//
// Multi-pass strategy (each pass only runs when found.size < 2 after the previous):
//   Pass 1: original file → zxing-wasm (tryHarder/Rotate/Invert/Downscale)
//   Pass 2: contrast(200%) → zxing-wasm  (mild boost for slightly-low-contrast labels)
//   Pass 3: contrast(300%) → zxing-wasm  (moderate boost)
//   Pass 4: contrast(400%) → zxing-wasm  (binarises silver labels: bars 80→5, bg 185→255)
//   Pass 5: sharpen + contrast(400%) → zxing-wasm  (blurry shots: recovers merged bar edges)
//   Pass 6: 4x4 tiled sharpen+contrast(400%) → zxing-wasm  (small barcodes + low contrast)
//
// Math: CSS contrast(X%) maps pixel p → 127 + (p - 127) × X/100, clamped to [0,255].
// Silver background ≈ 185 grey. Dark barcode bars ≈ 80 grey.
//   contrast(250%): bars → 39 (still grey!)
//   contrast(400%): bars → 5, silver → 255 — true binarisation of the label.
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
    const isLarge = Math.min(img.naturalWidth, img.naturalHeight) >= 1200;

    if (isLarge) {
      const base = imageToCanvas(img);

      // Passes 2-4: escalating contrast levels for silver/metallic labels.
      for (const contrast of [200, 300, 400]) {
        if (found.size >= 2) break;
        addFound(
          found,
          await readBarcodesFromImageData(
            getImageData(applyContrastFilter(base, contrast)),
            READER_OPTIONS,
          ),
        );
      }

      if (found.size < 2) {
        // Pass 5: sharpened + contrast(400%) — recovers blurry barcode bar edges.
        addFound(
          found,
          await readBarcodesFromImageData(
            getSharpenedImageData(applyContrastFilter(base, 400)),
            READER_OPTIONS,
          ),
        );
      }

      if (found.size < 2) {
        // Pass 6: 4×4 tiled sharpened+contrast(400%) — small barcodes + low contrast.
        await runTiledZxing(applyContrastFilter(base, 400), found, 4, true);
      }
    }
  }

  const out: string[] = [];
  found.forEach((t) => out.push(t));
  return out;
};
