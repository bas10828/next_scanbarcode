"use client";
import React, { useRef, useState } from "react";
import readXlsxFile from "read-excel-file";
import {
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Stack,
  Card,
  Chip,
  IconButton,
  Tooltip,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import DescriptionIcon from "@mui/icons-material/Description";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import ClearIcon from "@mui/icons-material/Clear";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { ExcelRow, ReportImage } from "./types";
import { generateReportText } from "./reportGenerator";
import { exportReportToWord } from "./wordExport";

type FileKind = "project" | "inventory";

const FILE_CONFIG = {
  project: { label: "Project File", color: "#eff6ff", border: "#bfdbfe", chip: "primary" as const },
  inventory: { label: "Inventory File", color: "#f0fdf4", border: "#bbf7d0", chip: "success" as const },
};

function computeLineImages(
  reportText: string,
  images: ReportImage[],
): Record<number, ReportImage[]> {
  if (images.length === 0) return {};
  const result: Record<number, ReportImage[]> = {};
  reportText.split("\n").forEach((line, idx) => {
    const matches = Array.from(line.matchAll(/\(([^()]+)\)/g));
    const candidates = matches.filter((m) => m[1].length > 2 && /[A-Za-z]/.test(m[1]));
    if (candidates.length === 0) return;
    const label = candidates[candidates.length - 1][1].toUpperCase();
    const matched = images.filter((img) => img.name.toUpperCase().includes(label));
    if (matched.length > 0) result[idx] = matched;
  });
  return result;
}

const GenerateReport: React.FC = () => {
  const [projectData, setProjectData] = useState<ExcelRow[]>([]);
  const [inventoryData, setInventoryData] = useState<ExcelRow[]>([]);
  const [projectName, setProjectName] = useState("");
  const [inventoryName, setInventoryName] = useState("");
  const [report, setReport] = useState<string>("");
  const [images, setImages] = useState<ReportImage[]>([]);
  const [lineImages, setLineImages] = useState<Record<number, ReportImage[]>>({});
  const [lineImagesHistory, setLineImagesHistory] = useState<Record<number, ReportImage[]>[]>([]);
  const projectRef = useRef<HTMLInputElement>(null);
  const inventoryRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    kind: FileKind,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !file.name.match(/\.xlsx?$/i)) {
      alert("กรุณาเลือกไฟล์ .xlsx เท่านั้น");
      return;
    }
    if (kind === "project") setProjectName(file.name);
    else setInventoryName(file.name);

    readXlsxFile(file)
      .then((rows) => {
        const normalized = rows.map((r) =>
          r.map((c) => (c === false || c === Date ? null : c)),
        ) as ExcelRow[];
        if (kind === "project") setProjectData(normalized);
        else setInventoryData(normalized);
      })
      .catch((err) => console.error("เกิดข้อผิดพลาดในการอ่านไฟล์:", err));

    event.target.value = "";
  };

  const readImageFile = (file: File): Promise<ReportImage> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const b64 = dataUrl.split(",")[1];
        const img = document.createElement("img");
        img.onload = () =>
          resolve({ dataUrl, b64, w: img.naturalWidth, h: img.naturalHeight, name: file.name });
        img.onerror = reject;
        img.src = dataUrl;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAddImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const newImages = await Promise.all(files.map(readImageFile));
    setImages((prev) => [...prev, ...newImages]);
  };

  const handleDeleteImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const pushLineHistory = (s: Record<number, ReportImage[]>) =>
    setLineImagesHistory((h) => [...h, s]);

  const handleLineImageDelete = (lineIdx: number, imgIdx: number) => {
    setLineImages((prev) => {
      pushLineHistory(prev);
      const arr = [...(prev[lineIdx] ?? [])];
      arr.splice(imgIdx, 1);
      if (arr.length === 0) {
        const next = { ...prev };
        delete next[lineIdx];
        return next;
      }
      return { ...prev, [lineIdx]: arr };
    });
  };

  const handleLineImageMove = (lineIdx: number, imgIdx: number, dir: -1 | 1) => {
    setLineImages((prev) => {
      pushLineHistory(prev);
      const arr = [...(prev[lineIdx] ?? [])];
      const target = imgIdx + dir;
      if (target < 0 || target >= arr.length) return prev;
      [arr[imgIdx], arr[target]] = [arr[target], arr[imgIdx]];
      return { ...prev, [lineIdx]: arr };
    });
  };

  const handleUndoLineImage = () => {
    setLineImagesHistory((h) => {
      if (h.length === 0) return h;
      setLineImages(h[h.length - 1]);
      return h.slice(0, -1);
    });
  };

  const handleDeleteRow = (rowIndex: number) => {
    setProjectData((prev) => {
      const next = [...prev];
      next.splice(rowIndex + 1, 1);
      return next;
    });
  };

  const handleGenerate = () => {
    const text = generateReportText(projectData, inventoryData);
    setReport(text);
    setLineImages(computeLineImages(text, images));
  };

  const handleExportWord = async () => {
    try {
      await exportReportToWord(report, lineImages);
    } catch (err) {
      console.error("Error exporting Word file:", err);
      alert("เกิดข้อผิดพลาดในการส่งออกไฟล์ Word");
    }
  };

  return (
    <Stack spacing={3}>
      {/* File upload section */}
      <Box
        display="grid"
        gridTemplateColumns={{ xs: "1fr", sm: "repeat(3, 1fr)" }}
        gap={2}
      >
        {(["project", "inventory"] as const).map((kind) => {
          const cfg = FILE_CONFIG[kind];
          const name = kind === "project" ? projectName : inventoryName;
          const hasData = kind === "project" ? projectData.length > 0 : inventoryData.length > 0;
          const ref = kind === "project" ? projectRef : inventoryRef;

          return (
            <Card
              key={kind}
              onClick={() => ref.current?.click()}
              sx={{
                p: 2.5,
                bgcolor: cfg.color,
                border: "2px dashed",
                borderColor: hasData ? cfg.border : "grey.300",
                borderRadius: 2,
                cursor: "pointer",
                transition: "all 0.2s",
                "&:hover": { borderColor: cfg.border, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
              }}
            >
              <Box display="flex" alignItems="center" gap={1.5}>
                <UploadFileIcon sx={{ color: hasData ? "primary.main" : "grey.400", fontSize: 28 }} />
                <Box flex={1}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {cfg.label}
                  </Typography>
                  {name ? (
                    <Chip
                      label={name}
                      size="small"
                      color={cfg.chip}
                      sx={{ mt: 0.5, maxWidth: "100%", fontSize: "0.7rem" }}
                    />
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      คลิกเพื่อเลือกไฟล์ .xlsx
                    </Typography>
                  )}
                </Box>
              </Box>
              <input
                ref={ref}
                type="file"
                accept=".xlsx,.xls"
                hidden
                onChange={(e) => handleFileUpload(e, kind)}
              />
            </Card>
          );
        })}

        {/* Image upload card */}
        <Card
          onClick={() => imagesRef.current?.click()}
          sx={{
            p: 2.5,
            bgcolor: "#fdf4ff",
            border: "2px dashed",
            borderColor: images.length > 0 ? "#d8b4fe" : "grey.300",
            borderRadius: 2,
            cursor: "pointer",
            transition: "all 0.2s",
            "&:hover": { borderColor: "#d8b4fe", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
          }}
        >
          <Box display="flex" alignItems="center" gap={1.5}>
            <AddPhotoAlternateIcon sx={{ color: images.length > 0 ? "secondary.main" : "grey.400", fontSize: 28 }} />
            <Box flex={1}>
              <Typography variant="subtitle2" fontWeight={600}>
                เพิ่มรูป
              </Typography>
              {images.length > 0 ? (
                <Chip
                  label={`${images.length} รูป`}
                  size="small"
                  color="secondary"
                  sx={{ mt: 0.5, fontSize: "0.7rem" }}
                />
              ) : (
                <Typography variant="caption" color="text.secondary">
                  คลิกเพื่อเลือกรูปภาพ
                </Typography>
              )}
            </Box>
          </Box>
          <input
            ref={imagesRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleAddImages}
          />
        </Card>
      </Box>

      {/* Image gallery */}
      {images.length > 0 && (
        <Box display="flex" flexWrap="wrap" gap={1.5}>
          {images.map((img, idx) => (
            <Box key={idx} position="relative" sx={{ width: 80 }}>
              <Box
                component="img"
                src={img.dataUrl}
                sx={{
                  width: 80,
                  height: 60,
                  objectFit: "cover",
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "grey.300",
                  display: "block",
                }}
              />
              <IconButton
                size="small"
                onClick={() => handleDeleteImage(idx)}
                sx={{
                  position: "absolute",
                  top: -8,
                  right: -8,
                  bgcolor: "error.main",
                  color: "white",
                  width: 20,
                  height: 20,
                  "&:hover": { bgcolor: "error.dark" },
                }}
              >
                <ClearIcon sx={{ fontSize: 12 }} />
              </IconButton>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontSize: "0.6rem",
                  textAlign: "center",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 80,
                  color: "text.secondary",
                }}
              >
                {img.name}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {projectData.length > 0 && (
        <DataTable title="Project Data" data={projectData} onDeleteRow={handleDeleteRow} />
      )}
      {inventoryData.length > 0 && (
        <DataTable title="Inventory Data" data={inventoryData} />
      )}

      <Button
        variant="contained"
        color="primary"
        size="large"
        fullWidth
        onClick={handleGenerate}
        startIcon={<AutoAwesomeIcon />}
        disabled={projectData.length === 0 && inventoryData.length === 0}
        sx={{ py: 1.5 }}
      >
        Generate Report
      </Button>

      {report && (
        <Card
          variant="outlined"
          sx={{ p: 3, bgcolor: "#fffbf7", borderColor: "#fed7aa" }}
        >
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <DescriptionIcon sx={{ color: "primary.main" }} />
            <Typography variant="h6" fontWeight={700}>
              Generated Report
            </Typography>
          </Box>

          <Box
            sx={{
              whiteSpace: "pre-wrap",
              bgcolor: "white",
              border: "1px solid",
              borderColor: "grey.200",
              borderRadius: 1.5,
              p: 2.5,
              fontFamily: "Arial, sans-serif",
              fontSize: "0.95rem",
              color: "grey.800",
              lineHeight: 1.8,
              overflow: "auto",
              maxHeight: "60vh",
            }}
          >
            {report.split("\n").map((line, i) => (
              <div key={i}>
                <div>{line || " "}</div>
                {lineImages[i] && (
                  <Box display="flex" flexWrap="wrap" gap={1} my={0.5}>
                    {lineImages[i].map((img, j) => (
                      <Box key={j} sx={{ width: 80 }}>
                        <Box
                          component="img"
                          src={img.dataUrl}
                          title={img.name}
                          sx={{
                            width: 80,
                            height: 60,
                            objectFit: "cover",
                            borderRadius: "4px 4px 0 0",
                            border: "1px solid",
                            borderColor: "grey.200",
                            display: "block",
                          }}
                        />
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          sx={{ bgcolor: "grey.100", borderRadius: "0 0 4px 4px", border: "1px solid", borderTop: 0, borderColor: "grey.200" }}
                        >
                          <IconButton
                            size="small"
                            disabled={j === 0}
                            onClick={() => handleLineImageMove(i, j, -1)}
                            sx={{ p: 0.3 }}
                          >
                            <ChevronLeftIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleLineImageDelete(i, j)}
                            sx={{ p: 0.3, color: "error.main" }}
                          >
                            <ClearIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            disabled={j === lineImages[i].length - 1}
                            onClick={() => handleLineImageMove(i, j, 1)}
                            sx={{ p: 0.3 }}
                          >
                            <ChevronRightIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </div>
            ))}
          </Box>

          <Button
            onClick={handleExportWord}
            variant="contained"
            color="success"
            startIcon={<DescriptionIcon />}
            sx={{ mt: 2 }}
          >
            Export to Word
          </Button>
        </Card>
      )}

      {lineImagesHistory.length > 0 && (
        <Box
          sx={{
            position: "fixed",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            bgcolor: "grey.900",
            color: "white",
            borderRadius: 3,
            px: 2,
            py: 1,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            boxShadow: 4,
            zIndex: 1300,
          }}
        >
          <Typography variant="body2" sx={{ color: "grey.300", fontSize: "0.82rem" }}>
            ลบรูปออกไปแล้ว
          </Typography>
          <Button
            size="small"
            variant="contained"
            color="warning"
            onClick={handleUndoLineImage}
            sx={{ minWidth: 64, fontWeight: 700, fontSize: "0.8rem" }}
          >
            Undo ({lineImagesHistory.length})
          </Button>
        </Box>
      )}
    </Stack>
  );
};

type DataTableProps = {
  title: string;
  data: ExcelRow[];
  onDeleteRow?: (rowIndex: number) => void;
};

const DataTable: React.FC<DataTableProps> = ({ title, data, onDeleteRow }) => (
  <Box>
    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
      {title}
      <Chip
        label={`${data.length - 1} rows`}
        size="small"
        sx={{ ml: 1, fontSize: "0.7rem" }}
      />
    </Typography>
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ borderRadius: 1.5, overflow: "hidden" }}
    >
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: "grey.100" }}>
            {data[0].map((header, idx) => (
              <TableCell key={idx} sx={{ fontWeight: 700, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                {header as string}
              </TableCell>
            ))}
            {onDeleteRow && (
              <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem" }}>Actions</TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.slice(1).map((row, idx) => (
            <TableRow key={idx} hover sx={{ "&:last-child td": { border: 0 } }}>
              {row.map((cell, cellIdx) => (
                <TableCell key={cellIdx} sx={{ fontSize: "0.82rem" }}>
                  {cell as string}
                </TableCell>
              ))}
              {onDeleteRow && (
                <TableCell>
                  <Tooltip title="ลบแถวนี้">
                    <IconButton size="small" color="error" onClick={() => onDeleteRow(idx)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  </Box>
);

export default GenerateReport;
