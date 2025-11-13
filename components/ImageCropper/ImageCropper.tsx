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
} from "@mui/material";

interface ImageItem {
  file: File;
  url: string;
  crop: { x: number; y: number };
  zoom: number;
  aspect: number;
  croppedAreaPixels?: any;
}

const aspectOptions = [
  { label: "1:1", value: 1 },
  { label: "16:9", value: 16 / 9 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:4", value: 3 / 4 },
  { label: "2:1", value: 2 },
  { label: "1:2", value: 0.5 },
  { label: "21:9", value: 21 / 9 },
  { label: "9:21", value: 9 / 21 },
  { label: "5:4", value: 5 / 4 },
  { label: "4:5", value: 4 / 5 },
];

export default function ImageCropper() {
  const [images, setImages] = useState<ImageItem[]>([]);

  const handleSelectImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const mapped = files.map((f) => ({
      file: f,
      url: URL.createObjectURL(f),
      crop: { x: 0, y: 0 },
      zoom: 1,
      aspect: 1,
    }));
    setImages(mapped);
  };

  const updateImage = (idx: number, changes: Partial<ImageItem>) => {
    setImages((prev) => {
      const newImages = [...prev];
      newImages[idx] = { ...newImages[idx], ...changes };
      return newImages;
    });
  };

  const onCropComplete = (idx: number, _: any, croppedPixels: any) => {
    updateImage(idx, { croppedAreaPixels: croppedPixels });
  };

  const getCroppedImg = async (imageSrc: string, crop: any) => {
    const image = new Image();
    image.src = imageSrc;
    await image.decode();

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const { width, height, x, y } = crop;

    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(image, x, y, width, height, 0, 0, width, height);

    return new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg")
    );
  };

  const saveAll = async () => {
    try {
      const win: any = window; // cast เป็น any เพื่อ TypeScript

      if (!win.showDirectoryPicker) {
        alert("❌ Browser ของคุณไม่รองรับการบันทึกไฟล์แบบนี้");
        return;
      }

      const dir = await win.showDirectoryPicker();
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (!img.croppedAreaPixels) continue;
        const blob = await getCroppedImg(img.url, img.croppedAreaPixels);
        if (!blob) continue;

        const handle = await dir.getFileHandle(`cropped_${img.file.name}`, {
          create: true,
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      }

      alert("✅ ครอปรูปทั้งหมดเสร็จแล้ว!");
    } catch (err) {
      console.error(err);
      alert("❌ เกิดข้อผิดพลาดในการบันทึกไฟล์");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>✂️ ครอปรูปภาพ (เลือกสัดส่วนได้)</h2>
      <input type="file" multiple accept="image/*" onChange={handleSelectImages} />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          marginTop: 20,
          justifyContent: "flex-start",
        }}
      >
        {images.map((img, idx) => (
          <div
            key={idx}
            style={{
              border: "1px solid #ccc",
              borderRadius: 8,
              padding: 5,
              width: 600,
              height: 600,
              background: "#333",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              <Cropper
                image={img.url}
                crop={img.crop}
                zoom={img.zoom}
                aspect={img.aspect}
                onCropChange={(c) => updateImage(idx, { crop: c })}
                onZoomChange={(z) => updateImage(idx, { zoom: z })}
                onCropComplete={(_, pixels) => onCropComplete(idx, _, pixels)}
              />
            </div>

            <div style={{ marginTop: 5 }}>
              <Slider
                value={img.zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(_, val) => updateImage(idx, { zoom: val as number })}
              />
            </div>

            <FormControl size="small" fullWidth sx={{ marginTop: 1 }}>
              <InputLabel>Aspect</InputLabel>
              <Select
                value={img.aspect}
                label="Aspect"
                onChange={(e) =>
                  updateImage(idx, { aspect: e.target.value as number })
                }
              >
                {aspectOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        ))}
      </div>

      {images.length > 0 && (
        <Button variant="contained" onClick={saveAll} sx={{ marginTop: 3 }}>
          💾 บันทึกภาพที่ครอปทั้งหมด
        </Button>
      )}
    </div>
  );
}
