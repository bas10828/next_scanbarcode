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
  Tooltip,
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import UndoIcon from "@mui/icons-material/Undo";
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
  const [undoStack, setUndoStack] = useState<{ result: BarcodeResult; rowData: RowData; index: number }[]>([]);
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
    setUndoStack((prev) => [
      ...prev,
      { result: results[index], rowData: rows[index] ?? EMPTY_ROW, index },
    ]);
    setResults((prev) => prev.filter((_, i) => i !== index));
    setRows((prev) => {
      const next: Record<number, RowData> = {};
      Object.entries(prev).forEach(([key, val]) => {
        const k = Number(key);
        if (k < index) next[k] = val;
        else if (k > index) next[k - 1] = val;
      });
      return next;
    });
  };

  const handleUndo = () => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const { result, rowData, index } = prev[prev.length - 1];
      setResults((r) => {
        const next = [...r];
        next.splice(index, 0, result);
        return next;
      });
      setRows((r) => {
        const next: Record<number, RowData> = {};
        Object.entries(r).forEach(([key, val]) => {
          const k = Number(key);
          next[k >= index ? k + 1 : k] = val;
        });
        next[index] = rowData;
        return next;
      });
      return prev.slice(0, -1);
    });
  };

  const handleClearAll = () => {
    setResults([]);
    setRows({});
    setUndoStack([]);
    autoAppliedRef.current = null;
  };

  const handleFiles = async (files: File[]) => {
    setRows({});
    setUndoStack([]);
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

      {undoStack.length > 0 && (
        <Box
          sx={{
            position: "sticky",
            bottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 2,
            bgcolor: "warning.50",
            border: "1px solid",
            borderColor: "warning.200",
            borderRadius: 2,
            px: 2,
            py: 1.5,
            boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
            zIndex: 10,
          }}
        >
          <UndoIcon fontSize="small" color="warning" />
          <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
            ลบไป {undoStack.length} แถว — ย้อนกลับได้
          </Typography>
          <Tooltip title={`คืน "${removeFileExtension(undoStack[undoStack.length - 1].result.fileName)}" กลับ`}>
            <Button
              variant="contained"
              color="warning"
              size="small"
              onClick={handleUndo}
              startIcon={<UndoIcon />}
            >
              Undo
            </Button>
          </Tooltip>
        </Box>
      )}
    </Stack>
  );
};

export default BarcodeScanWorkflow;
