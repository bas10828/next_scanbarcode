"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Box,
  Stack,
  Typography,
  Card,
  Chip,
  Button,
  IconButton,
  Tooltip,
} from "@mui/material";
import RotateLeftIcon from "@mui/icons-material/RotateLeft";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import SaveAltIcon from "@mui/icons-material/SaveAlt";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import FileDropZone from "../common/FileDropZone";

type ImageItem = {
  file: File;
  url: string;
  rotation: number;
};

export default function ImageRotator() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [saving, setSaving] = useState(false);

  const handleFiles = (files: File[]) => {
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages(files.map((f) => ({ file: f, url: URL.createObjectURL(f), rotation: 0 })));
  };

  const rotateBy = (idx: number, deg: number) => {
    setImages((prev) =>
      prev.map((im, i) => (i === idx ? { ...im, rotation: im.rotation + deg } : im)),
    );
  };

  const handleDelete = (idx: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleClearAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages([]);
  };

  const handleReset = (idx: number) => {
    setImages((prev) =>
      prev.map((im, i) => (i === idx ? { ...im, rotation: 0 } : im)),
    );
  };

  const saveAll = async () => {
    const win = window as unknown as {
      showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
    };
    if (!win.showDirectoryPicker) {
      alert("❌ Browser ของคุณไม่รองรับการบันทึกไฟล์ — ใช้ Chrome หรือ Edge");
      return;
    }
    setSaving(true);
    try {
      const dir = await win.showDirectoryPicker();
      let saved = 0;
      for (const imgData of images) {
        const imageEl = new window.Image();
        imageEl.src = imgData.url;
        await imageEl.decode();

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        const radians = (imgData.rotation * Math.PI) / 180;
        const sin = Math.abs(Math.sin(radians));
        const cos = Math.abs(Math.cos(radians));
        canvas.width = imageEl.width * cos + imageEl.height * sin;
        canvas.height = imageEl.width * sin + imageEl.height * cos;

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(radians);
        ctx.drawImage(imageEl, -imageEl.width / 2, -imageEl.height / 2);

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/jpeg"),
        );
        if (!blob) continue;

        const handle = await dir.getFileHandle(`rotated_${imgData.file.name}`, { create: true });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        saved++;
      }
      alert(`✅ บันทึก ${saved} ไฟล์เสร็จแล้ว`);
    } catch (err) {
      if ((err as Error).name !== "AbortError") alert("❌ เกิดข้อผิดพลาดในการบันทึกไฟล์");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <FileDropZone
        onFiles={handleFiles}
        hint="หมุนรูปภาพ 90° ซ้าย/ขวา — รองรับหลายภาพพร้อมกัน"
      />

      {images.length > 0 && (
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          <Chip label={`${images.length} ภาพ`} color="primary" size="small" />
          <Box flexGrow={1} />
          <Button
            variant="outlined"
            color="inherit"
            size="small"
            onClick={handleClearAll}
            startIcon={<DeleteOutlineIcon />}
            disabled={saving}
          >
            ล้างทั้งหมด
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={saveAll}
            startIcon={<SaveAltIcon />}
            disabled={saving}
          >
            {saving ? "กำลังบันทึก..." : "บันทึกทั้งหมด"}
          </Button>
        </Box>
      )}

      <Box
        display="grid"
        gridTemplateColumns={{ xs: "1fr", md: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" }}
        gap={2}
      >
        {images.map((img, idx) => (
          <Card
            key={idx}
            sx={{
              p: 1.5,
              border: "1px solid",
              borderColor: "grey.200",
              boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
              display: "flex",
              flexDirection: "column",
              gap: 1.25,
            }}
          >
            <Typography variant="caption" color="text.secondary" noWrap>
              {img.file.name}
            </Typography>

            <Box
              sx={{
                width: "100%",
                height: 300,
                bgcolor: "#1f2937",
                borderRadius: 1.5,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Image
                src={img.url}
                alt={img.file.name}
                width={400}
                height={300}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  transform: `rotate(${img.rotation}deg)`,
                  transition: "transform 0.3s ease",
                }}
              />
            </Box>

            <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
              <Tooltip title="หมุนซ้าย 90°">
                <IconButton onClick={() => rotateBy(idx, -90)}>
                  <RotateLeftIcon />
                </IconButton>
              </Tooltip>

              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 48, textAlign: "center" }}>
                {((img.rotation % 360) + 360) % 360}°
              </Typography>

              <Tooltip title="หมุนขวา 90°">
                <IconButton onClick={() => rotateBy(idx, 90)}>
                  <RotateRightIcon />
                </IconButton>
              </Tooltip>

              <Box flexGrow={1} />

              <Tooltip title="Reset">
                <IconButton size="small" onClick={() => handleReset(idx)}>
                  <RestartAltIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="ลบรูปนี้">
                <IconButton size="small" color="error" onClick={() => handleDelete(idx)}>
                  <DeleteOutlineIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Card>
        ))}
      </Box>

      {images.length === 0 && (
        <Box textAlign="center" py={4}>
          <Typography color="text.secondary" variant="body2">
            ยังไม่มีภาพ — อัปโหลดด้านบนเพื่อเริ่มหมุน
          </Typography>
        </Box>
      )}
    </Stack>
  );
}
