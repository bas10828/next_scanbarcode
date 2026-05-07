import React, { useEffect, useRef, useState } from "react";
import "../../dynamsoft.config";
import { CameraEnhancer, CameraView } from "dynamsoft-camera-enhancer";
import { CaptureVisionRouter } from "dynamsoft-capture-vision-router";
import { MultiFrameResultCrossFilter } from "dynamsoft-utility";
import "./VideoCapture.css";
import { Box, Stack, Typography, Paper, Chip } from "@mui/material";
import QrCodeIcon from "@mui/icons-material/QrCode";

const componentDestroyedErrorMsg = "VideoCapture Component Destroyed";

type ScanResult = { format: string; text: string };

function VideoCapture() {
  const cameraViewContainer = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<ScanResult[]>([]);

  useEffect((): any => {
    let resolveInit: () => void;
    const pInit: Promise<void> = new Promise((r) => { resolveInit = r; });
    let isDestroyed = false;
    let cvRouter: CaptureVisionRouter;
    let cameraEnhancer: CameraEnhancer;

    (async () => {
      try {
        const cameraView = await CameraView.createInstance();
        if (isDestroyed) throw Error(componentDestroyedErrorMsg);
        cameraEnhancer = await CameraEnhancer.createInstance(cameraView);
        if (isDestroyed) throw Error(componentDestroyedErrorMsg);

        cameraViewContainer.current!.append(cameraView.getUIElement());

        cvRouter = await CaptureVisionRouter.createInstance();
        if (isDestroyed) throw Error(componentDestroyedErrorMsg);
        cvRouter.setInput(cameraEnhancer);

        cvRouter.addResultReceiver({
          onDecodedBarcodesReceived: (result) => {
            if (!result.barcodeResultItems.length) return;
            setResults(
              result.barcodeResultItems.map((item) => ({
                format: item.formatString,
                text: item.text,
              })),
            );
          },
        });

        const filter = new MultiFrameResultCrossFilter();
        filter.enableResultCrossVerification("barcode", true);
        filter.enableResultDeduplication("barcode", true);
        await cvRouter.addResultFilter(filter);
        if (isDestroyed) throw Error(componentDestroyedErrorMsg);

        await cameraEnhancer.open();
        if (isDestroyed) throw Error(componentDestroyedErrorMsg);
        await cvRouter.startCapturing("ReadSingleBarcode");
        if (isDestroyed) throw Error(componentDestroyedErrorMsg);
      } catch (ex: any) {
        if ((ex as Error)?.message === componentDestroyedErrorMsg) {
          console.log(componentDestroyedErrorMsg);
        } else {
          const errMsg = ex.message || ex;
          console.error(errMsg);
          alert(errMsg);
        }
      }
    })();

    resolveInit!();

    return async () => {
      isDestroyed = true;
      try {
        await pInit;
        cvRouter?.dispose();
        cameraEnhancer?.dispose();
      } catch (_) {}
    };
  }, []);

  const cleanlineSN = results
    .map((r) => r.text.match(/LCL\d{6,}/)?.[0])
    .find(Boolean) ?? null;

  return (
    <Stack spacing={2}>
      <div ref={cameraViewContainer} className="camera-view-container" />

      {results.length > 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            bgcolor: "#fff7ed",
            borderColor: "#fed7aa",
            borderRadius: 2,
          }}
        >
          <Box display="flex" alignItems="center" gap={1} mb={1.5}>
            <QrCodeIcon sx={{ fontSize: 18, color: "primary.main" }} />
            <Typography variant="caption" fontWeight={700} color="primary.main">
              ผลการสแกนล่าสุด
            </Typography>
          </Box>
          {cleanlineSN && (
            <Box
              sx={{
                mb: 1.5,
                px: 1.5,
                py: 0.75,
                bgcolor: "#dcfce7",
                borderRadius: 1,
                border: "1px solid #bbf7d0",
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Chip
                label="Cleanline SN"
                size="small"
                sx={{ fontSize: "0.68rem", height: 20, bgcolor: "#16a34a", color: "#fff", fontWeight: 600 }}
              />
              <Typography variant="body2" fontFamily="monospace" fontWeight={700} color="#15803d">
                {cleanlineSN}
              </Typography>
            </Box>
          )}
          <Stack spacing={0.75}>
            {results.map((r, i) => (
              <Box key={i} display="flex" alignItems="center" gap={1.5}>
                <Chip
                  label={r.format}
                  size="small"
                  sx={{
                    fontSize: "0.68rem",
                    height: 20,
                    bgcolor: "#fed7aa",
                    color: "#9a3412",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                />
                <Typography
                  variant="body2"
                  fontFamily="monospace"
                  sx={{ wordBreak: "break-all", color: "#7c2d12" }}
                >
                  {r.text}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>
      ) : (
        <Box
          sx={{
            p: 2,
            bgcolor: "#f8fafc",
            border: "1px dashed",
            borderColor: "grey.300",
            borderRadius: 2,
            textAlign: "center",
          }}
        >
          <Typography variant="body2" color="text.secondary" fontStyle="italic">
            ผลการ scan จะแสดงที่นี่ — เปิดกล้องแล้วชี้ไปที่ barcode/QR
          </Typography>
        </Box>
      )}
    </Stack>
  );
}

export default VideoCapture;
