"use client";
import React, { useState } from "react";
import heic2any from "heic2any";
import {
  Typography,
  Button,
  Box,
  Stack,
  Card,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import Image from "next/image";
import FileDropZone from "../common/FileDropZone";

type ConvertedImage = { name: string; url: string };

const ImageConvert: React.FC = () => {
  const [converted, setConverted] = useState<ConvertedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const handleFiles = async (files: File[]) => {
    const heicFiles = files.filter(
      (f) => f.type === "image/heic" || f.name.toLowerCase().endsWith(".heic"),
    );
    if (heicFiles.length === 0) {
      alert("ไม่พบไฟล์ .heic — กรุณาเลือกไฟล์ HEIC เท่านั้น");
      return;
    }

    setLoading(true);
    setProgress({ done: 0, total: heicFiles.length });
    converted.forEach((img) => URL.revokeObjectURL(img.url));

    const results: ConvertedImage[] = [];
    for (const file of heicFiles) {
      try {
        const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
        results.push({ name: file.name.replace(/\.heic$/i, ".jpg"), url: URL.createObjectURL(blob as Blob) });
      } catch (err) {
        console.error(`Conversion failed for ${file.name}:`, err);
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    setConverted(results);
    setLoading(false);
  };

  const handleDownload = (url: string, name: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
  };

  const handleDownloadAll = () => {
    converted.forEach((img) => handleDownload(img.url, img.name));
  };

  const handleDelete = (idx: number) => {
    setConverted((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleClearAll = () => {
    converted.forEach((img) => URL.revokeObjectURL(img.url));
    setConverted([]);
  };

  const busyText = loading
    ? `กำลังแปลงไฟล์ ${progress.done}/${progress.total}`
    : undefined;

  return (
    <Stack spacing={2}>
      <FileDropZone
        onFiles={handleFiles}
        accept=".heic"
        mimePrefix=""
        hint="แปลงไฟล์ HEIC → JPEG — รองรับหลายไฟล์พร้อมกัน"
        busy={loading}
        busyText={busyText}
      />

      {loading && progress.total > 0 && (
        <LinearProgress
          variant="determinate"
          value={(progress.done / progress.total) * 100}
        />
      )}

      {converted.length > 0 && (
        <>
          <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
            <Chip
              label={`${converted.length} ไฟล์`}
              color="primary"
              size="small"
            />
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
              onClick={handleDownloadAll}
              startIcon={<FileDownloadIcon />}
            >
              ดาวน์โหลดทั้งหมด
            </Button>
          </Box>

          <Box
            display="grid"
            gridTemplateColumns={{ xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)", xl: "repeat(4, 1fr)" }}
            gap={2}
          >
            {converted.map((img, idx) => (
              <Card
                key={idx}
                sx={{
                  p: 1,
                  border: "1px solid",
                  borderColor: "grey.200",
                  boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    position: "relative",
                    width: "100%",
                    height: 180,
                    bgcolor: "#f1f5f9",
                    borderRadius: 1,
                    overflow: "hidden",
                  }}
                >
                  <Image
                    src={img.url}
                    alt={img.name}
                    fill
                    sizes="(max-width:600px) 100vw, 300px"
                    style={{ objectFit: "contain" }}
                  />
                </Box>

                <Box display="flex" alignItems="center" gap={0.5} px={0.5}>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                    {img.name}
                  </Typography>
                  <Tooltip title="ดาวน์โหลด">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleDownload(img.url, img.name)}
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="ลบ">
                    <IconButton size="small" color="error" onClick={() => handleDelete(idx)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Card>
            ))}
          </Box>
        </>
      )}

      {converted.length === 0 && !loading && (
        <Box textAlign="center" py={4}>
          <Typography color="text.secondary" variant="body2">
            ยังไม่มีไฟล์ — อัปโหลดไฟล์ HEIC ด้านบนเพื่อแปลง
          </Typography>
        </Box>
      )}
    </Stack>
  );
};

export default ImageConvert;
