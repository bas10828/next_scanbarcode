import React from "react";
import "../../dynamsoft.config";
import { useBarcodeDecoder } from "./useBarcodeDecoder";
import BarcodeScanWorkflow from "../common/BarcodeScanWorkflow";

function ImageCapture() {
  const decoder = useBarcodeDecoder();
  return (
    <BarcodeScanWorkflow
      {...decoder}
      hint="Dynamsoft High-Accuracy mode — รองรับ QR + 1D barcode (Code128, EAN, ฯลฯ)"
      busyLabel="Dynamsoft High-Accuracy"
      exportFileName="barcode_results.xlsx"
    />
  );
}

export default ImageCapture;
