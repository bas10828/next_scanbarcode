"use client";

import React, { useState, useCallback, memo } from "react";
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
  IconButton,
  Tooltip,
} from "@mui/material";
import RotateLeftIcon from "@mui/icons-material/RotateLeft";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SaveAltIcon from "@mui/icons-material/SaveAlt";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FileDropZone from "../common/FileDropZone";
import { cropAndRotate, type PixelCrop } from "./cropRotateHelper";

type Aspect = number | "free";

type ImageItem = {
  file: File;
  url: string;
  crop: { x: number; y: number };
  zoom: number;
  rotation: number;
  aspect: Aspect;
  croppedAreaPixels?: PixelCrop;
};

const aspectOptions: { label: string; value: Aspect }[] = [
  { label: "Free", value: "free" },
  { label: "1:1", value: 1 },
  { label: "16:9", value: 16 / 9 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:4", value: 3 / 4 },
  { label: "3:2", value: 3 / 2 },
  { label: "2:3", value: 2 / 3 },
  { label: "21:9", value: 21 / 9 },
];

const initialState = (file: File): ImageItem => ({
  file,
  url: URL.createObjectURL(file),
  crop: { x: 0, y: 0 },
  zoom: 1,
  rotation: 0,
  aspect: 1,
});

type ImageCardProps = {
  img: ImageItem;
  idx: number;
  onUpdate: (idx: number, changes: Partial<ImageItem>) => void;
  onDelete: (idx: number) => void;
  onReset: (idx: number) => void;
  onRotate: (idx: number, dir: "left" | "right") => void;
};

const ImageCard = memo(function ImageCard({
  img,
  idx,
  onUpdate,
  onDelete,
  onReset,
  onRotate,
}: ImageCardProps) {
  return (
    <Card
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
          height: 380,
          bgcolor: "#1f2937",
          borderRadius: 1.5,
          overflow: "hidden",
        }}
      >
        <Cropper
          image={img.url}
          crop={img.crop}
          zoom={img.zoom}
          rotation={img.rotation}
          aspect={img.aspect === "free" ? undefined : img.aspect}
          onCropChange={(c) => onUpdate(idx, { crop: c })}
          onZoomChange={(z) => onUpdate(idx, { zoom: z })}
          onRotationChange={(r) => onUpdate(idx, { rotation: r })}
          onCropComplete={(_, pixels) =>
            onUpdate(idx, { croppedAreaPixels: pixels })
          }
          showGrid={true}
          restrictPosition={true}
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
            onChange={(_, v) => onUpdate(idx, { zoom: v as number })}
          />
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary">
            Rotation: {Math.round(img.rotation)}°
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title="หมุนซ้าย 90°">
              <IconButton size="small" onClick={() => onRotate(idx, "left")}>
                <RotateLeftIcon />
              </IconButton>
            </Tooltip>
            <Slider
              value={img.rotation}
              min={-180}
              max={180}
              step={1}
              size="small"
              onChange={(_, v) => onUpdate(idx, { rotation: v as number })}
            />
            <Tooltip title="หมุนขวา 90°">
              <IconButton size="small" onClick={() => onRotate(idx, "right")}>
                <RotateRightIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Box display="flex" gap={1} alignItems="center">
          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel>Aspect</InputLabel>
            <Select
              value={img.aspect}
              label="Aspect"
              onChange={(e) =>
                onUpdate(idx, { aspect: e.target.value as Aspect })
              }
            >
              {aspectOptions.map((opt) => (
                <MenuItem key={String(opt.value)} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title="Reset (ครอป/หมุน/ซูม)">
            <IconButton size="small" onClick={() => onReset(idx)}>
              <RestartAltIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="ลบรูปนี้">
            <IconButton
              size="small"
              color="error"
              onClick={() => onDelete(idx)}
            >
              <DeleteOutlineIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Stack>
    </Card>
  );
});

export default function ImageEditor() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [saving, setSaving] = useState(false);

  const handleFiles = useCallback((files: File[]) => {
    setImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.url));
      return files.map(initialState);
    });
  }, []);

  const update = useCallback((idx: number, changes: Partial<ImageItem>) => {
    setImages((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...changes };
      return next;
    });
  }, []);

  const handleDelete = useCallback((idx: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const handleClearAll = useCallback(() => {
    setImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.url));
      return [];
    });
  }, []);

  const handleReset = useCallback((idx: number) => {
    setImages((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], crop: { x: 0, y: 0 }, zoom: 1, rotation: 0, aspect: 1 };
      return next;
    });
  }, []);

  const rotateBy90 = useCallback((idx: number, dir: "left" | "right") => {
    setImages((prev) => {
      const next = [...prev];
      const cur = next[idx].rotation;
      const rotated = dir === "left" ? cur - 90 : cur + 90;
      const wrapped = ((rotated + 180) % 360 + 360) % 360 - 180;
      next[idx] = { ...next[idx], rotation: wrapped };
      return next;
    });
  }, []);

  const saveAll = async () => {
    if (images.length === 0) return;
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
        const blob = await cropAndRotate(
          img.url,
          img.croppedAreaPixels,
          img.rotation,
        );
        if (!blob) continue;
        const handle = await dir.getFileHandle(`edited_${img.file.name}`, {
          create: true,
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        saved++;
      }
      alert(`✅ บันทึก ${saved} ไฟล์เสร็จแล้ว`);
    } catch (err) {
      console.error(err);
      if ((err as Error).name !== "AbortError") {
        alert("❌ เกิดข้อผิดพลาดในการบันทึกไฟล์");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <FileDropZone
        onFiles={handleFiles}
        hint="ครอป + หมุน + ปรับสัดส่วน — แก้หลายภาพได้พร้อมกัน บันทึกทั้งหมดในคลิกเดียว"
      />

      <Box
        display="grid"
        gridTemplateColumns={{
          xs: "1fr",
          md: "repeat(2, 1fr)",
          xl: "repeat(3, 1fr)",
        }}
        gap={2}
      >
        {images.map((img, idx) => (
          <ImageCard
            key={img.url}
            img={img}
            idx={idx}
            onUpdate={update}
            onDelete={handleDelete}
            onReset={handleReset}
            onRotate={rotateBy90}
          />
        ))}
      </Box>

      {images.length > 0 && (
        <Box
          display="flex"
          alignItems="center"
          gap={2}
          flexWrap="wrap"
          sx={{
            position: "sticky",
            bottom: 16,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "grey.200",
            borderRadius: 2,
            px: 2,
            py: 1.5,
            boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
            zIndex: 10,
          }}
        >
          <SaveAltIcon fontSize="small" color="primary" />
          <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
            แก้ไขเสร็จแล้ว? บันทึกได้เลย
          </Typography>
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

      {images.length === 0 && (
        <Box textAlign="center" py={4}>
          <Typography color="text.secondary" variant="body2">
            ยังไม่มีภาพ — อัปโหลดด้านบนเพื่อเริ่มแก้ไข
          </Typography>
        </Box>
      )}
    </Stack>
  );
}
