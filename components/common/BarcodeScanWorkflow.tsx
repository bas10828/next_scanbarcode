"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Checkbox,
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import UndoIcon from "@mui/icons-material/Undo";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
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
  detectBrand,
  type Brand,
  type ParsedBarcode,
} from "../ImageCapture/barcodeParsers";
import type { BarcodeResult } from "../ImageCapture/useBarcodeDecoder";
import FileDropZone from "./FileDropZone";

type RowData = ParsedBarcode & { brand: Brand | "" };
const EMPTY_ROW: RowData = { brand: "", serial: "", mac: "", mac_: "", model: "" };

// Each duplicate group gets its own color so users can tell which rows share the same value.
// 16 distinct colors — handles up to 16 duplicate groups before cycling.
const DUP_PALETTE = [
  { bg: "#fee2e2", fg: "#991b1b" }, // red
  { bg: "#ffedd5", fg: "#9a3412" }, // orange
  { bg: "#fef9c3", fg: "#854d0e" }, // yellow
  { bg: "#d1fae5", fg: "#065f46" }, // green
  { bg: "#dbeafe", fg: "#1e40af" }, // blue
  { bg: "#ede9fe", fg: "#5b21b6" }, // purple
  { bg: "#fce7f3", fg: "#9d174d" }, // pink
  { bg: "#e0f2fe", fg: "#075985" }, // teal
  { bg: "#fef3c7", fg: "#92400e" }, // amber
  { bg: "#ecfccb", fg: "#3f6212" }, // lime
  { bg: "#cffafe", fg: "#155e75" }, // cyan
  { bg: "#f0fdf4", fg: "#14532d" }, // emerald
  { bg: "#fdf4ff", fg: "#701a75" }, // fuchsia
  { bg: "#fff1f2", fg: "#9f1239" }, // rose
  { bg: "#f0f9ff", fg: "#0c4a6e" }, // sky
  { bg: "#fafaf9", fg: "#44403c" }, // stone
] as const;

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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const autoAppliedRef = useRef<BarcodeResult[] | null>(null);

  const toggleSelect = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) =>
      prev.size === results.length
        ? new Set()
        : new Set(results.map((_, i) => i)),
    );
  };

  const handleApplyToSelected = (brand: Brand) => {
    selected.forEach((index) =>
      applyBrand(index, resolveBrand(brand, results[index].barcodeText), results),
    );
  };

  const applyBrand = useCallback(
    (index: number, brand: Brand, sourceResults: BarcodeResult[]) => {
      const parsed = parseBarcode(brand, sourceResults[index].barcodeText);
      setRows((prev) => ({ ...prev, [index]: { brand, ...parsed } }));
    },
    [],
  );

  // Auto-apply brand once per fresh results array. When brand is "auto", detect per-row
  // so Cleanline (and other brand-specific parsers) get applied automatically.
  useEffect(() => {
    if (
      autoApplyBrand &&
      results.length > 0 &&
      autoAppliedRef.current !== results
    ) {
      autoAppliedRef.current = results;
      results.forEach((result, i) => {
        const brand =
          autoApplyBrand === "auto"
            ? detectBrand(result.barcodeText)
            : autoApplyBrand;
        applyBrand(i, brand, results);
      });
    }
  }, [results, autoApplyBrand, applyBrand]);

  const resolveBrand = useCallback(
    (brand: Brand, barcodeText: string[]) =>
      brand === "auto" ? detectBrand(barcodeText) : brand,
    [],
  );

  const handleBrandChange = (index: number, brand: Brand) => {
    applyBrand(index, resolveBrand(brand, results[index].barcodeText), results);
  };

  const handleSelectAll = (brand: Brand) => {
    results.forEach((result, index) =>
      applyBrand(index, resolveBrand(brand, result.barcodeText), results),
    );
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
    setSelected((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  };

  const handleUndo = () => {
    setSelected(new Set());
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
    setSelected(new Set());
    autoAppliedRef.current = null;
  };

  const handleFiles = async (files: File[]) => {
    setRows({});
    setUndoStack([]);
    setSelected(new Set());
    autoAppliedRef.current = null;
    await decode(files);
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      results.map((result, index) => {
        const row = rows[index] ?? EMPTY_ROW;
        return {
          BarcodeText: result.barcodeText.join(", "),
          FileName: removeFileExtension(result.fileName),
          Brand: row.brand,
          Model: row.model,
          Serial: row.serial,
          MAC: row.mac,
          MAC_: row.mac_,
        };
      }),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Barcode Results");
    XLSX.writeFile(wb, exportFileName);
  };

  // Duplicate detection — each unique duplicate value gets a 1-based group number (unlimited)
  // and a cycling palette color (16 colors). Both are shown together in the cell.
  const { snGroupMap, macGroupMap, dupSnGroups, dupMacGroups } = useMemo(() => {
    const snCounts = new Map<string, number>();
    const macCounts = new Map<string, number>();
    results.forEach((_, i) => {
      const sn = rows[i]?.serial;
      const mac = rows[i]?.mac_;
      if (sn && sn !== "non" && sn !== "") snCounts.set(sn, (snCounts.get(sn) ?? 0) + 1);
      if (mac && mac !== "non" && mac !== "") macCounts.set(mac, (macCounts.get(mac) ?? 0) + 1);
    });
    let idx = 1;
    const snGroupMap = new Map<string, number>(); // value → 1-based group number
    snCounts.forEach((count, sn) => { if (count > 1) snGroupMap.set(sn, idx++); });
    const macGroupMap = new Map<string, number>();
    macCounts.forEach((count, mac) => { if (count > 1) macGroupMap.set(mac, idx++); });
    return { snGroupMap, macGroupMap, dupSnGroups: snGroupMap.size, dupMacGroups: macGroupMap.size };
  }, [rows, results]);

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
            {(dupSnGroups > 0 || dupMacGroups > 0) && (
              <Chip
                icon={<WarningAmberIcon sx={{ fontSize: "1rem !important" }} />}
                label={[
                  dupSnGroups > 0 && `SN ซ้ำ ${dupSnGroups} กลุ่ม`,
                  dupMacGroups > 0 && `MAC ซ้ำ ${dupMacGroups} กลุ่ม`,
                ].filter(Boolean).join(" · ")}
                color="error"
                size="small"
                variant="outlined"
              />
            )}
            <FormControl variant="outlined" size="small" sx={{ minWidth: 200 }}>
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
                  <StyledTableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selected.size === results.length && results.length > 0}
                      indeterminate={selected.size > 0 && selected.size < results.length}
                      onChange={toggleSelectAll}
                      sx={{ color: "inherit" }}
                    />
                  </StyledTableCell>
                  <StyledTableCell>Barcode Text</StyledTableCell>
                  <StyledTableCell>File Name</StyledTableCell>
                  <StyledTableCell>Brand</StyledTableCell>
                  <StyledTableCell>Model</StyledTableCell>
                  <StyledTableCell>Serial</StyledTableCell>
                  <StyledTableCell>MAC</StyledTableCell>
                  <StyledTableCell>MAC_</StyledTableCell>
                  <StyledTableCell align="center">Action</StyledTableCell>
                </TableRow>
              </StyledTableHead>
              <TableBody>
                {results.map((result, index) => {
                  const row = rows[index] ?? EMPTY_ROW;
                  const isSelected = selected.has(index);
                  const snGroup = snGroupMap.get(row.serial);
                  const macGroup = macGroupMap.get(row.mac_);
                  const rowGroup = snGroup ?? macGroup;
                  const rowPalette = rowGroup != null ? DUP_PALETTE[(rowGroup - 1) % DUP_PALETTE.length] : null;
                  return (
                    <StyledTableRow
                      key={index}
                      sx={{
                        ...(rowPalette ? { bgcolor: rowPalette.bg } : isSelected ? { bgcolor: "primary.50" } : {}),
                        ...(rowPalette && isSelected ? { outline: "2px solid", outlineColor: "primary.main", outlineOffset: "-2px" } : {}),
                      }}
                    >
                      <StyledTableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={isSelected}
                          onChange={() => toggleSelect(index)}
                        />
                      </StyledTableCell>
                      <StyledTableCell sx={{ fontFamily: "monospace", fontSize: "0.85em" }}>
                        {result.barcodeText.join(", ")}
                      </StyledTableCell>
                      <StyledTableCell>{removeFileExtension(result.fileName)}</StyledTableCell>
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
                      <StyledTableCell>{row.model}</StyledTableCell>
                      <StyledTableCell
                        sx={rowPalette ? { color: rowPalette.fg, fontWeight: 700 } : undefined}
                      >
                        {rowGroup != null ? (
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <Box component="span" sx={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              minWidth: 18, height: 18, borderRadius: "50%",
                              bgcolor: rowPalette!.fg, color: "#fff",
                              fontSize: "0.6rem", fontWeight: 800, flexShrink: 0,
                            }}>
                              {rowGroup}
                            </Box>
                            {row.serial}
                          </Box>
                        ) : row.serial}
                      </StyledTableCell>
                      <StyledTableCell sx={{ fontFamily: "monospace" }}>
                        {row.mac}
                      </StyledTableCell>
                      <StyledTableCell sx={{ fontFamily: "monospace" }}>
                        {row.mac_}
                      </StyledTableCell>
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

          <Box display="flex" justifyContent="flex-end" pt={1}>
            <Button
              variant="contained"
              color="primary"
              onClick={exportToExcel}
              startIcon={<FileDownloadIcon />}
            >
              Export Excel
            </Button>
          </Box>
        </>
      )}

      {results.length === 0 && !busy && (
        <Box textAlign="center" py={4}>
          <Typography color="text.secondary" variant="body2">
            ยังไม่มีผลการ scan — อัปโหลดภาพด้านบนเพื่อเริ่มต้น
          </Typography>
        </Box>
      )}

      {selected.size > 0 && (
        <Box
          sx={{
            position: "sticky",
            bottom: undoStack.length > 0 ? 80 : 16,
            display: "flex",
            alignItems: "center",
            gap: 2,
            bgcolor: "primary.50",
            border: "1px solid",
            borderColor: "primary.200",
            borderRadius: 2,
            px: 2,
            py: 1.5,
            boxShadow: "0 4px 12px rgba(15,23,42,0.16)",
            zIndex: 11,
          }}
        >
          <Chip
            label={`เลือกไว้ ${selected.size} แถว`}
            color="primary"
            size="small"
          />
          <FormControl variant="outlined" size="small" sx={{ minWidth: 200 }}>
            <InputLabel>เปลี่ยนแบรนด์ที่เลือก</InputLabel>
            <Select
              onChange={(e) => handleApplyToSelected(e.target.value as Brand)}
              label="เปลี่ยนแบรนด์ที่เลือก"
              value=""
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
            size="small"
            variant="outlined"
            color="primary"
            onClick={() => setSelected(new Set())}
          >
            ยกเลิกการเลือก
          </Button>
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
