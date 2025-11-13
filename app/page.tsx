"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import "./page.css";

const VideoCapture = dynamic(
  () => import("../components/VideoCapture/VideoCapture"),
  { ssr: false }
);
const ImageCapture = dynamic(
  () => import("../components/ImageCapture/ImageCapture"),
  { ssr: false }
);
const ImageConvert = dynamic(
  () => import("../components/convertfile/Imageconvert"),
  { ssr: false }
);
const GenerateReport = dynamic(
  () => import("../components/GenerateReport/GenerateReport"),
  { ssr: false }
);
const ImageCropper = dynamic(
  () => import("../components/ImageCropper/ImageCropper"),
  { ssr: false }
);
const ImageRotator = dynamic(
  () => import("../components/ImageRotator/ImageRotator"),
  { ssr: false }
);

enum Modes {
  VIDEO_CAPTURE = "video",
  IMAGE_CAPTURE = "image",
  IMAGE_CONVERT = "convert",
  GENERATE_REPORT = "GenerateReport",
  IMAGE_CROPPER = "ImageCropper",
  IMAGE_ROTATOR = "ImageRotator",
}

export default function Home() {
  const [mode, setMode] = useState(Modes.IMAGE_CAPTURE);

  return (
    <div className="hello-world-page">
      <div className="title">
        <h2 className="title-text">Scan Barcode&QRcode</h2>
      </div>

      <div className="buttons-container">
        <button
          style={{
            backgroundColor:
              mode === Modes.VIDEO_CAPTURE ? "rgb(255,174,55)" : "white",
          }}
          onClick={() => setMode(Modes.VIDEO_CAPTURE)}
        >
          Decode Video
        </button>

        <button
          style={{
            backgroundColor:
              mode === Modes.IMAGE_CAPTURE ? "rgb(255,174,55)" : "white",
          }}
          onClick={() => setMode(Modes.IMAGE_CAPTURE)}
        >
          Decode Image
        </button>

        <button
          style={{
            backgroundColor:
              mode === Modes.IMAGE_CONVERT ? "rgb(255,174,55)" : "white",
          }}
          onClick={() => setMode(Modes.IMAGE_CONVERT)}
        >
          Convert File
        </button>

        <button
          style={{
            backgroundColor:
              mode === Modes.GENERATE_REPORT ? "rgb(255,174,55)" : "white",
          }}
          onClick={() => setMode(Modes.GENERATE_REPORT)}
        >
          Generate Report
        </button>

        <button
          style={{
            backgroundColor:
              mode === Modes.IMAGE_ROTATOR ? "rgb(255,174,55)" : "white",
          }}
          onClick={() => setMode(Modes.IMAGE_ROTATOR)}
        >
          Rotate Image
        </button>

        <button
          style={{
            backgroundColor:
              mode === Modes.IMAGE_CROPPER ? "rgb(255,174,55)" : "white",
          }}
          onClick={() => setMode(Modes.IMAGE_CROPPER)}
        >
          Crop Image
        </button>
      </div>

      <div className="container">
        {mode === Modes.VIDEO_CAPTURE && <VideoCapture />}
        {mode === Modes.IMAGE_CAPTURE && <ImageCapture />}
        {mode === Modes.IMAGE_CONVERT && <ImageConvert />}
        {mode === Modes.GENERATE_REPORT && <GenerateReport />}
        {mode === Modes.IMAGE_ROTATOR && <ImageRotator />}
        {mode === Modes.IMAGE_CROPPER && <ImageCropper />}
      </div>
    </div>
  );
}
