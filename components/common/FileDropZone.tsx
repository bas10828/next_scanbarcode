"use client";
import React, { useRef, useState } from "react";
import { Box, Typography, CircularProgress, Chip } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

type FileDropZoneProps = {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  busy?: boolean;
  busyText?: string;
  hint?: string;
  /** Filter dropped files by MIME prefix, e.g. "image/" */
  mimePrefix?: string;
};

const FileDropZone: React.FC<FileDropZoneProps> = ({
  onFiles,
  accept = "image/*",
  multiple = true,
  busy = false,
  busyText,
  hint = "รองรับ .jpg, .png, .bmp, .gif, .webp",
  mimePrefix = "image/",
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const submitFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).filter((f) =>
      mimePrefix ? f.type.startsWith(mimePrefix) : true,
    );
    if (arr.length > 0) onFiles(arr);
  };

  return (
    <Box
      onClick={() => !busy && inputRef.current?.click()}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!busy) submitFiles(e.dataTransfer.files);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      sx={{
        border: "2px dashed",
        borderColor: dragging ? "primary.main" : "grey.300",
        borderRadius: 3,
        bgcolor: dragging ? "#fff7ed" : busy ? "grey.100" : "#fafbfc",
        py: 5,
        px: 3,
        textAlign: "center",
        cursor: busy ? "wait" : "pointer",
        transition: "all 0.2s ease",
        userSelect: "none",
        boxShadow: dragging ? "0 0 0 4px rgba(245, 124, 0, 0.12)" : "none",
        transform: dragging ? "scale(1.005)" : "scale(1)",
        "&:hover": busy
          ? undefined
          : {
              borderColor: "primary.main",
              bgcolor: "#fff7ed",
              boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
            },
      }}
    >
      {busy ? (
        <>
          <CircularProgress size={40} thickness={4} sx={{ mb: 1.5, color: "primary.main" }} />
          <Typography variant="body1" fontWeight={600} color="text.primary">
            {busyText ?? "กำลังประมวลผล..."}
          </Typography>
        </>
      ) : (
        <>
          <CloudUploadIcon
            sx={{
              fontSize: 56,
              color: dragging ? "primary.main" : "grey.400",
              mb: 1.5,
              transition: "color 0.2s ease, transform 0.2s ease",
              transform: dragging ? "translateY(-4px)" : "none",
            }}
          />
          <Typography variant="body1" fontWeight={600} color="text.primary">
            ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือก
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            mt={0.75}
            sx={{ maxWidth: 560, mx: "auto", lineHeight: 1.6 }}
          >
            {hint}
            {multiple && (
              <Chip
                size="small"
                label="เลือกหลายไฟล์ได้"
                sx={{
                  ml: 1,
                  height: 20,
                  fontSize: "0.7rem",
                  bgcolor: "#fed7aa",
                  color: "#9a3412",
                  fontWeight: 600,
                }}
              />
            )}
          </Typography>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        hidden
        onChange={(e) => {
          submitFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </Box>
  );
};

export default FileDropZone;
