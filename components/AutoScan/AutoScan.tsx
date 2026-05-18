"use client";
import React from "react";
import { useZXingDecoder } from "./useZXingDecoder";
import BarcodeScanWorkflow from "../common/BarcodeScanWorkflow";

const AutoScan: React.FC = () => {
  const decoder = useZXingDecoder();
  return (
    <BarcodeScanWorkflow
      {...decoder}
      hint="zxing-wasm (C++ WASM) — ฟรี ไม่ต้องใช้ license · แม่นยำกว่า JS port · เลือกแบรนด์ใน column หรือใช้ Auto-Detect"
      busyLabel="zxing-wasm"
      exportFileName="autoscan_results.xlsx"
      autoApplyBrand="auto"
    />
  );
};

export default AutoScan;
