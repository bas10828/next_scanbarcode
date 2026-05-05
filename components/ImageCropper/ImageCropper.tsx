"use client";

import React, { useState } from "react";
import Cropper from "react-easy-crop";
import {
  Button,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Stack,
  Typography,
  Card,
  Chip,
  IconButton,
  Tooltip,
} from "@mui/material";
import SaveAltIcon from "@mui/icons-material/SaveAlt";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import FileDropZone from "../common/FileDropZone";

type PixelCrop = { x: number; y: number; width: number; height: number };

type ImageItem = {
  file: File;
  url: string;
  crop: { x: number; y: number };
  zoom: number;
  aspect: number;
  croppedAreaPixels?: PixelCrop;
};

const aspectOptions = [
  { label: "1:1", value: 1 },
  { label: "16:9", value: 16 / 9 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:4", value: 3 / 4 },
  { label: "3:2", value: 3 / 2 },
  { label: "2:3", value: 2 / 3 },
  { label: "21:9", value: 21 / 9 },
  { label: "9:21", value: 9 / 21 },
];

const getCroppedImg = async (
  imageSrc: string,
  crop: PixelCrop,
): Promise<Blob | null> => {
  const image = new Image();
  image.src = imageSrc;
  await image.decode();
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = crop.width;
  canvas.height = crop.height;
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg"));
};

export default function ImageCropper() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [saving, setSaving] = useState(false);

  const handleFiles = (files: File[]) => {
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages(
      files.map((f) => ({
        file: f,
        url: URL.createObjectURL(f),
        crop: { x: 0, y: 0 },
        zoom: 1,
        aspect: 1,
      })),
    );
  };

  const update = (idx: number, changes: Partial<ImageItem>) => {
    setImages((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...changes };
      return next;
    });
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
    update(idx, { crop: { x: 0, y: 0 }, zoom: 1, aspect: 1 });
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
      for (const img of images) {
        if (!img.croppedAreaPixels) continue;
        const blob = await getCroppedImg(img.url, img.croppedAreaPixels);
        if (!blob) continue;
        const handle = await dir.getFileHandle(`cropped_${img.file.name}`, { create: true });
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
        hint="ครอปรูปภาพตามสัดส่วนที่ต้องการ — รองรับหลายภาพพร้อมกัน"
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
                position: "relative",
                width: "100%",
                height: 340,
                bgcolor: "#1f2937",
                borderRadius: 1.5,
                overflow: "hidden",
              }}
            >
              <Cropper
                image={img.url}
                crop={img.crop}
                zoom={img.zoom}
                aspect={img.aspect}
                onCropChange={(c) => update(idx, { crop: c })}
                onZoomChange={(z) => update(idx, { zoom: z })}
                onCropComplete={(_, pixels) => update(idx, { croppedAreaPixels: pixels })}
                showGrid
              />
            </Box>

            <Stack spacing={1}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Zoom: {img.zoom.toFixed(2)}x
                </Typography>
                <Slider
                  value={img.zoom}
                  min={1}
                  max={3}
                  step={0.05}
                  size="small"
                  onChange={(_, v) => update(idx, { zoom: v as number })}
                />
              </Box>

              <Box display="flex" gap={1} alignItems="center">
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>Aspect</InputLabel>
                  <Select
                    value={img.aspect}
                    label="Aspect"
                    onChange={(e) => update(idx, { aspect: e.target.value as number })}
                  >
                    {aspectOptions.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
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
            </Stack>
          </Card>
        ))}
      </Box>

      {images.length === 0 && (
        <Box textAlign="center" py={4}>
          <Typography color="text.secondary" variant="body2">
            ยังไม่มีภาพ — อัปโหลดด้านบนเพื่อเริ่มครอป
          </Typography>
        </Box>
      )}
    </Stack>
  );
}
