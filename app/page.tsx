"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import "./page.css";

const VideoCapture = dynamic(() => import("../components/VideoCapture/VideoCapture"), {
  ssr: false,
});
const ImageCapture = dynamic(() => import("../components/ImageCapture/ImageCapture"), {
  ssr: false,
});

const ImageConvert = dynamic(() => import("../components/convertfile/Imageconvert"), {
  ssr: false,
});

const GenerateReport = dynamic(() => import("../components/GenerateReport/GenerateReport"), {
  ssr: false,
});

enum Modes {
  VIDEO_CAPTURE = "video",
  IMAGE_CAPTURE = "image",
  IMAGE_CONVERT = "convert",
  GENERATE_REPORT = "GenerateReport"
}

export default function Home() {
  const [mode, setMode] = useState(Modes.IMAGE_CAPTURE);

  const showVideoCapture = () => setMode(Modes.VIDEO_CAPTURE);
  const showImageCapture = () => setMode(Modes.IMAGE_CAPTURE);
  const showImageConvert = () => setMode(Modes.IMAGE_CONVERT);
  const showGenerateReport = () => setMode(Modes.GENERATE_REPORT);


  return (
    <div className="hello-world-page">
      <div className="title">
        <h2 className="title-text">Scan Barcode&QRcode</h2>
      </div>
      <div className="buttons-container">
        <button
          style={{
            backgroundColor: mode === Modes.VIDEO_CAPTURE ? "rgb(255,174,55)" : "white",
          }}
          onClick={showVideoCapture}
        >
          Decode Video
        </button>
        <button
          style={{
            backgroundColor: mode === Modes.IMAGE_CAPTURE ? "rgb(255,174,55)" : "white",
          }}
          onClick={showImageCapture}
        >
          Decode Image
        </button>
        <button
          style={{
            backgroundColor: mode === Modes.IMAGE_CAPTURE ? "rgb(255,174,55)" : "white",
          }}
          onClick={showImageConvert}
        >
          Convert File
        </button>
        <button
          style={{
            backgroundColor: mode === Modes.IMAGE_CAPTURE ? "rgb(255,174,55)" : "white",
          }}
          onClick={showGenerateReport}
        >
          Generate Report
        </button>
      </div>
      <div className="container">
        {mode === Modes.VIDEO_CAPTURE && <VideoCapture />}
        {mode === Modes.IMAGE_CAPTURE && <ImageCapture />}
        {mode === Modes.IMAGE_CONVERT && <ImageConvert />}
        {mode === Modes.GENERATE_REPORT && <GenerateReport />}
      </div>    </div>
  );
}
