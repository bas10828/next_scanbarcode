"use client";
import React from "react";
import { useZXingDecoder } from "./useZXingDecoder";
import BarcodeScanWorkflow from "../common/BarcodeScanWorkflow";

const AutoScan: React.FC = () => {
  const decoder = useZXingDecoder();
  return (
    <BarcodeScanWorkflow
      {...decoder}
      hint="ZXing multi-pass — ฟรี ไม่ต้องใช้ license · เลือกแบรนด์ใน column หรือใช้ Auto-Detect"
      busyLabel="ZXing multi-pass"
      exportFileName="autoscan_results.xlsx"
      autoApplyBrand="auto"
    />
  );
};

export default AutoScan;
