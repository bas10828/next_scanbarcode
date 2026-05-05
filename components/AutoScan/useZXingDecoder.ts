import { useCallback, useEffect, useRef, useState } from "react";
import type { BarcodeResult, DecodeProgress } from "../ImageCapture/useBarcodeDecoder";
import { decodeAllBarcodes } from "./zxingScanner";

// ZXing-backed decoder with the same hook shape as useBarcodeDecoder, so both
// can plug into the shared BarcodeScanWorkflow component interchangeably.
export const useZXingDecoder = () => {
  const [results, setResults] = useState<BarcodeResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<DecodeProgress>({ done: 0, total: 0 });
  const isDestroyed = useRef(false);

  useEffect(() => {
    isDestroyed.current = false;
    return () => {
      isDestroyed.current = true;
    };
  }, []);

  const decode = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setResults([]);
    setBusy(true);
    setProgress({ done: 0, total: files.length });

    const next: BarcodeResult[] = [];
    for (const file of files) {
      if (isDestroyed.current) return;
      try {
        const decoded = await decodeAllBarcodes(file);
        next.push({
          fileName: file.name,
          barcodeText: decoded.length === 0 ? ["No barcode found"] : decoded,
        });
      } catch (err) {
        console.error(`Failed to decode ${file.name}:`, err);
        next.push({ fileName: file.name, barcodeText: ["Error"] });
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    if (!isDestroyed.current) {
      setResults(next);
      setBusy(false);
    }
  }, []);

  return { results, setResults, decode, busy, progress };
};
