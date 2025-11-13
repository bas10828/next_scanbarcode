"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Button } from "@mui/material";

interface ImageItem {
  file: File;
  url: string;
  rotation: number;
  rotatedBlob?: Blob;
}

export default function ImageRotator() {
  const [images, setImages] = useState<ImageItem[]>([]);

  // เลือกรูปหลายไฟล์
  const handleSelectImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const mapped = files.map((f) => ({
      file: f,
      url: URL.createObjectURL(f),
      rotation: 0,
    }));
    setImages(mapped);
  };

  // หมุนภาพ
  const rotateImage = (idx: number, direction: "left" | "right") => {
    setImages((prev) =>
      prev.map((im, i) =>
        i === idx
          ? { ...im, rotation: direction === "left" ? im.rotation - 90 : im.rotation + 90 }
          : im
      )
    );
  };

  // บันทึกลงเครื่อง
  const saveAll = async () => {
    try {
      if (!("showDirectoryPicker" in window)) {
        alert("❌ Browser ของคุณไม่รองรับการบันทึกไฟล์แบบนี้");
        return;
      }

      const dir = await (window as any).showDirectoryPicker();

      for (let i = 0; i < images.length; i++) {
        const imgData = images[i];
        const imageEl = new window.Image();
        imageEl.src = imgData.url;
        await imageEl.decode();

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        const radians = (imgData.rotation * Math.PI) / 180;

        const sin = Math.abs(Math.sin(radians));
        const cos = Math.abs(Math.cos(radians));
        const newWidth = imageEl.width * cos + imageEl.height * sin;
        const newHeight = imageEl.width * sin + imageEl.height * cos;

        canvas.width = newWidth;
        canvas.height = newHeight;

        ctx.translate(newWidth / 2, newHeight / 2);
        ctx.rotate(radians);
        ctx.drawImage(imageEl, -imageEl.width / 2, -imageEl.height / 2);
        ctx.rotate(-radians);
        ctx.translate(-newWidth / 2, -newHeight / 2);

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/jpeg")
        );

        if (!blob) continue;
        const handle = await dir.getFileHandle(`rotated_${imgData.file.name}`, { create: true });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      }

      alert("✅ หมุนและบันทึกภาพทั้งหมดเสร็จแล้ว!");
    } catch (err) {
      console.error(err);
      alert("❌ เกิดข้อผิดพลาดในการบันทึกไฟล์");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginBottom: 20 }}>🌀 หมุนรูปภาพ (หลายไฟล์)</h2>

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
              padding: 10,
              width: 600,
              height: 600,
              background: "#f9f9f9",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              textAlign: "center",
              transition: "transform 0.3s",
            }}
          >
            <div
              style={{
                width: "100%",
                height: 400,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#333",
                borderRadius: 4,
              }}
            >
              <Image
                src={img.url}
                alt={img.file.name}
                width={600}
                height={400}
                style={{
                  transform: `rotate(${img.rotation}deg)`,
                  transition: "transform 0.3s",
                  objectFit: "contain",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 10,
              }}
            >
              <Button size="small" variant="outlined" onClick={() => rotateImage(idx, "left")}>
                ↺
              </Button>
              <Button size="small" variant="outlined" onClick={() => rotateImage(idx, "right")}>
                ↻
              </Button>
            </div>
          </div>
        ))}
      </div>

      {images.length > 0 && (
        <Button variant="contained" color="primary" onClick={saveAll} sx={{ marginTop: 3 }}>
          💾 บันทึกทั้งหมด
        </Button>
      )}
    </div>
  );
}
