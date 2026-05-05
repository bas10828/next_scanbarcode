import { useCallback, useEffect, useRef, useState } from "react";
import { EnumCapturedResultItemType } from "dynamsoft-core";
import type { BarcodeResultItem } from "dynamsoft-barcode-reader";
import { CaptureVisionRouter } from "dynamsoft-capture-vision-router";

export type BarcodeResult = {
  fileName: string;
  barcodeText: string[];
};

export type DecodeProgress = { done: number; total: number };

export const useBarcodeDecoder = () => {
  const [results, setResults] = useState<BarcodeResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<DecodeProgress>({ done: 0, total: 0 });
  const pCvRouter = useRef<Promise<CaptureVisionRouter> | null>(null);
  const isDestroyed = useRef(false);

  useEffect(() => {
    isDestroyed.current = false;
    return () => {
      isDestroyed.current = true;
      if (pCvRouter.current) {
        pCvRouter.current
          .then((router) => router.dispose())
          .catch(() => {});
      }
    };
  }, []);

  const decode = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setResults([]);
    setBusy(true);
    setProgress({ done: 0, total: files.length });

    try {
      const cvRouter = await (pCvRouter.current =
        pCvRouter.current || CaptureVisionRouter.createInstance());
      if (isDestroyed.current) return;

      const next: BarcodeResult[] = [];
      for (const file of files) {
        // ReadRateFirst trades speed for accuracy: enables aggressive deblur,
        // scale-up for small barcodes, multiple binarization modes, and multiple
        // localization strategies. Per-image cost rises ~2-4x but recall improves
        // markedly on faded/low-contrast labels (e.g. Unifi plastic prints).
        const result = await cvRouter.capture(file, "ReadBarcodes_ReadRateFirst");
        if (isDestroyed.current) return;

        const barcodes = result.items
          .filter((item) => item.type === EnumCapturedResultItemType.CRIT_BARCODE)
          .map((item) => (item as BarcodeResultItem).text);

        next.push({
          fileName: file.name,
          barcodeText: barcodes.length === 0 ? ["No barcode found"] : barcodes,
        });
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
      setResults(next);
    } catch (ex: any) {
      const errMsg = ex.message || ex;
      console.error(errMsg);
      alert(errMsg);
    } finally {
      setBusy(false);
    }
  }, []);

  return { results, setResults, decode, busy, progress };
};
