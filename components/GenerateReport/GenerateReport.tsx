"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Alert,
  Dialog,
  Checkbox,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import DescriptionIcon from "@mui/icons-material/Description";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import ClearIcon from "@mui/icons-material/Clear";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import CloseIcon from "@mui/icons-material/Close";
import type { ExcelRow, ReportImage } from "./types";
import { findOverQtyGroups, generateReportText } from "./reportGenerator";
import { exportReportToWord } from "./wordExport";
import { checkImages, computeLineImages } from "./imageMatch";
import { CATEGORY_LABEL, computeChecks, type Category } from "./checks";
import type { SectionMode } from "./sections";
import CheckPanel from "./CheckPanel";

type FileKind = "project" | "inventory";

const FILE_CONFIG = {
  project: { label: "Project File", color: "#eff6ff", border: "#bfdbfe", chip: "primary" as const },
  inventory: { label: "Inventory File", color: "#f0fdf4", border: "#bbf7d0", chip: "success" as const },
};

const GenerateReport: React.FC = () => {
  const [projectData, setProjectData] = useState<ExcelRow[]>([]);
  const [inventoryData, setInventoryData] = useState<ExcelRow[]>([]);
  const [projectName, setProjectName] = useState("");
  const [inventoryName, setInventoryName] = useState("");
  const [report, setReport] = useState<string>("");
  const [images, setImages] = useState<ReportImage[]>([]);
  const [lineImages, setLineImages] = useState<Record<number, ReportImage[]>>({});
  const [lineImagesHistory, setLineImagesHistory] = useState<Record<number, ReportImage[]>[]>([]);
  const [sectionMode, setSectionMode] = useState<SectionMode>("header");
  const [limitToEstimateQty, setLimitToEstimateQty] = useState(true);
  const [customKeywords, setCustomKeywords] = useState<Record<number, string>>({});
  // Hand-picked devices per `${section}:${category}` (only where inventory > estimate).
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  // Full-screen photo viewer: which line + which photo within it.
  const [preview, setPreview] = useState<{ line: number; idx: number } | null>(null);
  const projectRef = useRef<HTMLInputElement>(null);
  const inventoryRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState<FileKind | "images" | null>(null);

  // A file dropped outside the upload cards would make the browser open it and
  // throw away everything loaded on this page. Swallow those drops.
  useEffect(() => {
    const stop = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", stop);
    };
  }, []);

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    kind: FileKind,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) loadXlsx(file, kind);
  };

  const loadXlsx = (file: File, kind: FileKind) => {
    if (!file.name.match(/\.xlsx?$/i)) {
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

  const addImageFiles = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|gif|bmp|webp)$/i.test(f.name));
    if (imgs.length === 0) return;
    const newImages = await Promise.all(imgs.map(readImageFile));
    setImages((prev) => [...prev, ...newImages]);
  };

  const handleAddImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    await addImageFiles(files);
  };

  // Drag & drop: files, or whole folders (walked recursively) for images.
  const filesFromDrop = async (dt: DataTransfer): Promise<File[]> => {
    const entries = Array.from(dt.items ?? [])
      .map((it) => (it.kind === "file" ? it.webkitGetAsEntry?.() : null))
      .filter((e): e is FileSystemEntry => !!e);
    if (entries.length === 0) return Array.from(dt.files);
    const out: File[] = [];
    const walk = async (entry: FileSystemEntry): Promise<void> => {
      if (entry.isFile) {
        out.push(await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej)));
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        // readEntries returns results in batches; call until empty.
        for (;;) {
          const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
          if (batch.length === 0) break;
          for (const child of batch) await walk(child);
        }
      }
    };
    for (const e of entries) await walk(e);
    return out;
  };

  const dropProps = (target: FileKind | "images") => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (dragOver !== target) setDragOver(target);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(null);
    },
    onDrop: async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(null);
      const files = await filesFromDrop(e.dataTransfer);
      if (target === "images") await addImageFiles(files);
      else {
        const xlsx = files.find((f) => /\.xlsx?$/i.test(f.name));
        if (xlsx) loadXlsx(xlsx, target);
        else alert("กรุณาลากไฟล์ .xlsx เท่านั้น");
      }
    },
  });

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

  const overQtyGroups = useMemo(
    () =>
      projectData.length > 0 && inventoryData.length > 0
        ? findOverQtyGroups(projectData, inventoryData, { sectionMode, customKeywords })
        : [],
    [projectData, inventoryData, sectionMode, customKeywords],
  );

  // Selection actually used: user's picks (only names still in the inventory),
  // else the first `qty` devices by Device Name.
  const effectiveSelection = useMemo(() => {
    const out: Record<string, string[]> = {};
    overQtyGroups.forEach((g) => {
      const names = new Set(g.candidates.map((c) => c.name));
      const mine = picked[g.key]?.filter((n) => names.has(n));
      out[g.key] = mine ?? g.candidates.slice(0, g.qty).map((c) => c.name);
    });
    return out;
  }, [overQtyGroups, picked]);

  const togglePick = (key: string, name: string) =>
    setPicked((prev) => {
      const cur = effectiveSelection[key] ?? [];
      const next = cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name];
      return { ...prev, [key]: next };
    });

  const reportOptions = {
    sectionMode,
    customKeywords,
    limitToEstimateQty,
    deviceSelection: effectiveSelection,
  };

  const checks = useMemo(
    () =>
      projectData.length > 0 && inventoryData.length > 0
        ? computeChecks(projectData, inventoryData, { sectionMode, customKeywords })
        : null,
    [projectData, inventoryData, sectionMode, customKeywords],
  );

  const imageCheck = useMemo(
    () => (report && images.length > 0 ? checkImages(report, images, lineImages) : null),
    [report, images, lineImages],
  );

  const handleGenerate = () => {
    const text = generateReportText(projectData, inventoryData, reportOptions);
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
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
          gap: 2,
        }}
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
              {...dropProps(kind)}
              sx={{
                p: 2.5,
                bgcolor: cfg.color,
                border: "2px dashed",
                borderColor: dragOver === kind ? "primary.main" : hasData ? cfg.border : "grey.300",
                borderRadius: 2,
                cursor: "pointer",
                transition: "all 0.2s",
                "&:hover": { borderColor: cfg.border, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <UploadFileIcon sx={{ color: hasData ? "primary.main" : "grey.400", fontSize: 28 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
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
                      คลิกหรือลากไฟล์ .xlsx มาวาง
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
          {...dropProps("images")}
          sx={{
            p: 2.5,
            bgcolor: "#fdf4ff",
            border: "2px dashed",
            borderColor: dragOver === "images" ? "secondary.main" : images.length > 0 ? "#d8b4fe" : "grey.300",
            borderRadius: 2,
            cursor: "pointer",
            transition: "all 0.2s",
            "&:hover": { borderColor: "#d8b4fe", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <AddPhotoAlternateIcon sx={{ color: images.length > 0 ? "secondary.main" : "grey.400", fontSize: 28 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
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
                  คลิกหรือลากรูป / โฟลเดอร์มาวาง
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
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          {images.map((img, idx) => (
            <Box key={idx} sx={{ position: "relative", width: 80 }}>
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

      {checks && (
        <CheckPanel
          checks={checks}
          mode={sectionMode}
          onModeChange={setSectionMode}
          limitQty={limitToEstimateQty}
          onLimitQtyChange={setLimitToEstimateQty}
          customKeywords={customKeywords}
          onKeywordChange={(i, v) => setCustomKeywords((prev) => ({ ...prev, [i]: v }))}
        />
      )}

      {overQtyGroups.length > 0 && (
        <Card variant="outlined" sx={{ p: 2.5, borderColor: "#fde68a", bgcolor: "#fffdf5" }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            เลือกอุปกรณ์ที่ใส่ในรายงานเล่มนี้
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
            หัวข้อด้านล่างมีอุปกรณ์ใน Inventory มากกว่าประมาณงาน — ติ๊กตัวที่จะลงในเล่มนี้ (ติ๊กไว้ให้ล่วงหน้า N ตัวแรก)
            ทำทีละเล่ม ระบบไม่จำการเลือกของเล่มก่อนหน้า
          </Typography>
          <Stack spacing={2}>
            {overQtyGroups.map((g) => {
              const sel = effectiveSelection[g.key] ?? [];
              const ok = sel.length === g.qty;
              return (
                <Box key={g.key}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {g.sectionNo}. {g.sectionName} — {CATEGORY_LABEL[g.cat as Category] ?? g.cat}
                    </Typography>
                    <Chip
                      size="small"
                      color={ok ? "success" : "warning"}
                      label={`เลือก ${sel.length} / ประมาณงาน ${g.qty}`}
                    />
                  </Box>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, columnGap: 2 }}>
                    {g.candidates.map((c) => (
                      <Box
                        key={c.name}
                        component="label"
                        sx={{ display: "flex", alignItems: "center", cursor: "pointer", fontSize: "0.82rem" }}
                      >
                        <Checkbox
                          size="small"
                          checked={sel.includes(c.name)}
                          onChange={() => togglePick(g.key, c.name)}
                        />
                        <b style={{ marginRight: 6 }}>{c.name}</b>
                        <span style={{ color: "#6b7280" }}>
                          {c.model} · {c.location}
                        </span>
                      </Box>
                    ))}
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </Card>
      )}

      <Button
        variant="contained"
        color="primary"
        size="large"
        fullWidth
        onClick={handleGenerate}
        startIcon={<AutoAwesomeIcon />}
        disabled={(projectData.length === 0 && inventoryData.length === 0) || Boolean(checks?.inventoryError)}
        sx={{ py: 1.5 }}
      >
        Generate Report
      </Button>

      {report && (
        <Card
          variant="outlined"
          sx={{ p: 3, bgcolor: "#fffbf7", borderColor: "#fed7aa" }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <DescriptionIcon sx={{ color: "primary.main" }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
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
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, my: 0.5 }}>
                    {lineImages[i].map((img, j) => (
                      <Box key={j} sx={{ width: 80 }}>
                        <Box
                          component="img"
                          src={img.dataUrl}
                          title={img.name}
                          onClick={() => setPreview({ line: i, idx: j })}
                          sx={{
                            cursor: "zoom-in",
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
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            bgcolor: "grey.100",
                            borderRadius: "0 0 4px 4px",
                            border: "1px solid",
                            borderTop: 0,
                            borderColor: "grey.200",
                          }}
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
                            onClick={() => setPreview({ line: i, idx: j })}
                            sx={{ p: 0.3 }}
                          >
                            <ZoomInIcon sx={{ fontSize: 14 }} />
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

          {imageCheck && (imageCheck.unused.length > 0 || imageCheck.shared.length > 0) && (
            <Stack spacing={1} sx={{ mt: 2 }}>
              {imageCheck.unused.length > 0 && (
                <Alert severity="warning">
                  <b>รูปที่ไม่ได้ใช้ ({imageCheck.unused.length})</b> — ชื่อไฟล์ไม่ตรงกับ Device Name บรรทัดไหน:{" "}
                  {imageCheck.unused.join(", ")}
                </Alert>
              )}
              {imageCheck.shared.length > 0 && (
                <Alert severity="info">
                  <b>รูปที่ไปอยู่หลายบรรทัด</b> — ลบออกจากบรรทัดที่ไม่ใช่:
                  {imageCheck.shared.map((s) => (
                    <div key={s.name} style={{ fontSize: "0.8rem" }}>
                      {s.name} → {s.lines.join(", ")}
                    </div>
                  ))}
                </Alert>
              )}
            </Stack>
          )}

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

      {(() => {
        const list = preview ? (lineImages[preview.line] ?? []) : [];
        const img = preview ? list[preview.idx] : undefined;
        const go = (d: -1 | 1) =>
          setPreview((p) => (p ? { ...p, idx: Math.min(list.length - 1, Math.max(0, p.idx + d)) } : p));
        return (
          <Dialog
            open={!!img}
            onClose={() => setPreview(null)}
            fullScreen
            slotProps={{ paper: { sx: { bgcolor: "rgba(0,0,0,0.92)" } } }}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") go(-1);
              if (e.key === "ArrowRight") go(1);
            }}
          >
            {img && preview && (
              <Box
                onClick={() => setPreview(null)}
                sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", p: 2 }}
              >
                <Box
                  onClick={(e) => e.stopPropagation()}
                  sx={{ display: "flex", alignItems: "center", gap: 2, color: "white", width: "100%", mb: 1 }}
                >
                  <Typography sx={{ flex: 1, fontWeight: 600 }}>
                    {img.name} ({preview.idx + 1}/{list.length}) — {report.split("\n")[preview.line]}
                  </Typography>
                  <IconButton onClick={() => setPreview(null)} sx={{ color: "white" }}>
                    <CloseIcon />
                  </IconButton>
                </Box>
                <Box sx={{ flex: 1, minHeight: 0, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
                  <IconButton
                    disabled={preview.idx === 0}
                    onClick={(e) => { e.stopPropagation(); go(-1); }}
                    sx={{ color: "white" }}
                  >
                    <ChevronLeftIcon sx={{ fontSize: 48 }} />
                  </IconButton>
                  <Box
                    component="img"
                    src={img.dataUrl}
                    onClick={(e) => e.stopPropagation()}
                    sx={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  />
                  <IconButton
                    disabled={preview.idx === list.length - 1}
                    onClick={(e) => { e.stopPropagation(); go(1); }}
                    sx={{ color: "white" }}
                  >
                    <ChevronRightIcon sx={{ fontSize: 48 }} />
                  </IconButton>
                </Box>
              </Box>
            )}
          </Dialog>
        );
      })()}

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
    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700 }}>
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
