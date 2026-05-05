"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Table,
  TableBody,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Box,
  Stack,
  Typography,
  LinearProgress,
  Chip,
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import * as XLSX from "xlsx";
import {
  StyledTableCell,
  StyledTableContainer,
  StyledTableHead,
  StyledTableRow,
} from "../ImageCapture/tableStyles";
import {
  BRAND_OPTIONS,
  parseBarcode,
  type Brand,
  type ParsedBarcode,
} from "../ImageCapture/barcodeParsers";
import type { BarcodeResult } from "../ImageCapture/useBarcodeDecoder";
import FileDropZone from "./FileDropZone";

type RowData = ParsedBarcode & { brand: Brand | "" };
const EMPTY_ROW: RowData = { brand: "", serial: "", mac: "", mac_: "", model: "" };

const removeFileExtension = (filename: string): string =>
  filename.replace(/\.[^/.]+$/, "");

export type BarcodeScanWorkflowProps = {
  results: BarcodeResult[];
  setResults: React.Dispatch<React.SetStateAction<BarcodeResult[]>>;
  decode: (files: File[]) => Promise<void>;
  busy: boolean;
  progress: { done: number; total: number };
  /** Drop-zone helper text describing the backend (e.g. "Dynamsoft High-Accuracy") */
  hint: string;
  /** Short backend label shown next to progress (e.g. "Dynamsoft") */
  busyLabel: string;
  /** Excel filename when exporting */
  exportFileName?: string;
  /** If set, parses every fresh result with this brand automatically (e.g. "auto" for AutoScan) */
  autoApplyBrand?: Brand;
};

const BarcodeScanWorkflow: React.FC<BarcodeScanWorkflowProps> = ({
  results,
  setResults,
  decode,
  busy,
  progress,
  hint,
  busyLabel,
  exportFileName = "barcode_results.xlsx",
  autoApplyBrand,
}) => {
  const [rows, setRows] = useState<Record<number, RowData>>({});
  const autoAppliedRef = useRef<BarcodeResult[] | null>(null);

  const applyBrand = useCallback(
    (index: number, brand: Brand, sourceResults: BarcodeResult[]) => {
      const parsed = parseBarcode(brand, sourceResults[index].barcodeText);
      setRows((prev) => ({ ...prev, [index]: { brand, ...parsed } }));
    },
    [],
  );

  // Auto-apply default brand once per fresh results array (won't re-fire on row edits/deletes).
  useEffect(() => {
    if (
      autoApplyBrand &&
      results.length > 0 &&
      autoAppliedRef.current !== results
    ) {
      autoAppliedRef.current = results;
      results.forEach((_, i) => applyBrand(i, autoApplyBrand, results));
    }
  }, [results, autoApplyBrand, applyBrand]);

  const handleBrandChange = (index: number, brand: Brand) => {
    applyBrand(index, brand, results);
  };

  const handleSelectAll = (brand: Brand) => {
    results.forEach((_, index) => applyBrand(index, brand, results));
  };

  const handleDeleteRow = (index: number) => {
    setResults((prev) => prev.filter((_, i) => i !== index));
    setRows((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const handleClearAll = () => {
    setResults([]);
    setRows({});
    autoAppliedRef.current = null;
  };

  const handleFiles = async (files: File[]) => {
    setRows({});
    autoAppliedRef.current = null;
    await decode(files);
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      results.map((result, index) => {
        const row = rows[index] ?? EMPTY_ROW;
        return {
          FileName: removeFileExtension(result.fileName),
          BarcodeText: result.barcodeText.join(", "),
          Brand: row.brand,
          Serial: row.serial,
          Model: row.model,
          MAC: row.mac,
          MAC_: row.mac_,
        };
      }),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Barcode Results");
    XLSX.writeFile(wb, exportFileName);
  };

  const busyText = busy
    ? `กำลัง scan ภาพ ${progress.done}/${progress.total} · ${busyLabel}`
    : undefined;

  return (
    <Stack spacing={2}>
      <FileDropZone onFiles={handleFiles} busy={busy} busyText={busyText} hint={hint} />

      {busy && progress.total > 0 && (
        <LinearProgress
          variant="determinate"
          value={(progress.done / progress.total) * 100}
        />
      )}

      {results.length > 0 && (
        <>
          <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
            <Chip label={`${results.length} ภาพ`} color="primary" size="small" />
            <FormControl variant="outlined" size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Apply brand to all</InputLabel>
              <Select
                onChange={(e) => handleSelectAll(e.target.value as Brand)}
                label="Apply brand to all"
                defaultValue=""
              >
                {BRAND_OPTIONS.map(({ value, label }) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box flexGrow={1} />
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              onClick={handleClearAll}
              startIcon={<DeleteOutlineIcon />}
            >
              ล้างทั้งหมด
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={exportToExcel}
              startIcon={<FileDownloadIcon />}
            >
              Export Excel
            </Button>
          </Box>

          <StyledTableContainer>
            <Table size="small">
              <StyledTableHead>
                <TableRow>
                  <StyledTableCell>File Name</StyledTableCell>
                  <StyledTableCell>Barcode Text</StyledTableCell>
                  <StyledTableCell>Brand</StyledTableCell>
                  <StyledTableCell>Serial</StyledTableCell>
                  <StyledTableCell>Model</StyledTableCell>
                  <StyledTableCell>MAC</StyledTableCell>
                  <StyledTableCell>MAC_</StyledTableCell>
                  <StyledTableCell align="center">Action</StyledTableCell>
                </TableRow>
              </StyledTableHead>
              <TableBody>
                {results.map((result, index) => {
                  const row = rows[index] ?? EMPTY_ROW;
                  return (
                    <StyledTableRow key={index}>
                      <StyledTableCell>{removeFileExtension(result.fileName)}</StyledTableCell>
                      <StyledTableCell sx={{ fontFamily: "monospace", fontSize: "0.85em" }}>
                        {result.barcodeText.join(", ")}
                      </StyledTableCell>
                      <StyledTableCell>
                        <Select
                          size="small"
                          value={row.brand}
                          onChange={(e) => handleBrandChange(index, e.target.value as Brand)}
                          sx={{ minWidth: 110 }}
                        >
                          {BRAND_OPTIONS.map(({ value, label }) => (
                            <MenuItem key={value} value={value}>
                              {label}
                            </MenuItem>
                          ))}
                        </Select>
                      </StyledTableCell>
                      <StyledTableCell>{row.serial}</StyledTableCell>
                      <StyledTableCell>{row.model}</StyledTableCell>
                      <StyledTableCell sx={{ fontFamily: "monospace" }}>{row.mac}</StyledTableCell>
                      <StyledTableCell sx={{ fontFamily: "monospace" }}>{row.mac_}</StyledTableCell>
                      <StyledTableCell align="center">
                        <Button
                          size="small"
                          variant="text"
                          color="error"
                          onClick={() => handleDeleteRow(index)}
                          startIcon={<DeleteOutlineIcon />}
                        >
                          ลบ
                        </Button>
                      </StyledTableCell>
                    </StyledTableRow>
                  );
                })}
              </TableBody>
            </Table>
          </StyledTableContainer>
        </>
      )}

      {results.length === 0 && !busy && (
        <Box textAlign="center" py={4}>
          <Typography color="text.secondary" variant="body2">
            ยังไม่มีผลการ scan — อัปโหลดภาพด้านบนเพื่อเริ่มต้น
          </Typography>
        </Box>
      )}
    </Stack>
  );
};

export default BarcodeScanWorkflow;
