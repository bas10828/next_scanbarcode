"use client";

import { useCallback, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

const API_URL =
  (process.env.NEXT_PUBLIC_OTDR_API_URL ?? "http://localhost:8001") + "/generate";

export default function OTDRReport() {
  const [files, setFiles] = useState<File[]>([]);
  const [projectName, setProjectName] = useState("OTDR");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("OTDR.pdf");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | File[]) => {
    const sor = Array.from(incoming).filter((f) =>
      f.name.toLowerCase().endsWith(".sor"),
    );
    if (sor.length === 0) return;
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...sor.filter((f) => !names.has(f.name))];
    });
    setStatus("idle");
    setDownloadUrl(null);
  };

  const removeFile = (name: string) =>
    setFiles((prev) => prev.filter((f) => f.name !== name));

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const generate = async () => {
    if (files.length === 0) return;
    setStatus("loading");
    setMessage("กำลังสร้าง PDF...");
    setDownloadUrl(null);

    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    form.append("project_name", projectName.trim() || "OTDR");

    try {
      const res = await fetch(API_URL, { method: "POST", body: form });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const fname = `${projectName.trim() || "OTDR"}.pdf`;
      setDownloadUrl(url);
      setDownloadName(fname);
      setStatus("done");
      setMessage(`สร้างเสร็จ — ${files.length} ไฟล์`);
    } catch (err: unknown) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
        OTDR Report Generator
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        อัปโหลดไฟล์ .sor แล้วกด Generate เพื่อสร้าง PDF
      </Typography>

      {/* Project name */}
      <TextField
        label="Project Name"
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        size="small"
        sx={{ mb: 2, width: 320 }}
      />

      {/* Drop zone */}
      <Box
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        sx={{
          border: "2px dashed",
          borderColor: dragging ? "primary.main" : "divider",
          borderRadius: 2,
          p: 4,
          textAlign: "center",
          cursor: "pointer",
          bgcolor: dragging ? "action.hover" : "background.default",
          transition: "all 0.15s",
          mb: 2,
        }}
      >
        <CloudUploadIcon sx={{ fontSize: 40, color: "primary.light", mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          ลาก .sor ไฟล์มาวาง หรือคลิกเพื่อเลือก
        </Typography>
        <input
          ref={inputRef}
          type="file"
          accept=".sor"
          multiple
          hidden
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </Box>

      {/* File list */}
      {files.length > 0 && (
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mb: 2 }}>
          {files
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((f) => (
              <Chip
                key={f.name}
                label={f.name}
                size="small"
                onDelete={() => removeFile(f.name)}
                deleteIcon={<DeleteIcon />}
                variant="outlined"
              />
            ))}
        </Stack>
      )}

      {/* Actions */}
      <Stack direction="row" sx={{ gap: 2, alignItems: "center" }}>
        <Button
          variant="contained"
          disabled={files.length === 0 || status === "loading"}
          onClick={generate}
          startIcon={
            status === "loading" ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <PictureAsPdfIcon />
            )
          }
        >
          {status === "loading" ? "กำลังสร้าง..." : `Generate PDF (${files.length} ไฟล์)`}
        </Button>

        {downloadUrl && (
          <Button
            variant="outlined"
            color="success"
            href={downloadUrl}
            download={downloadName}
            startIcon={<CheckCircleIcon />}
          >
            ดาวน์โหลด {downloadName}
          </Button>
        )}
      </Stack>

      {/* Status */}
      {status === "loading" && <LinearProgress sx={{ mt: 2 }} />}
      {message && (
        <Typography
          variant="body2"
          color={status === "error" ? "error" : status === "done" ? "success.main" : "text.secondary"}
          sx={{ mt: 1.5 }}
        >
          {message}
        </Typography>
      )}

      {/* PDF preview */}
      {downloadUrl && (
        <Box
          component="iframe"
          src={downloadUrl}
          sx={{
            mt: 3,
            width: "100%",
            height: "80vh",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
          }}
        />
      )}
    </Box>
  );
}
