"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Tabs,
  Tab,
  Box,
  Container,
  Paper,
  ThemeProvider,
  createTheme,
  CssBaseline,
} from "@mui/material";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import VideocamIcon from "@mui/icons-material/Videocam";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import TransformIcon from "@mui/icons-material/Transform";
import DescriptionIcon from "@mui/icons-material/Description";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import CropIcon from "@mui/icons-material/Crop";
import TuneIcon from "@mui/icons-material/Tune";

const VideoCapture = dynamic(
  () => import("../components/VideoCapture/VideoCapture"),
  { ssr: false },
);
const ImageCapture = dynamic(
  () => import("../components/ImageCapture/ImageCapture"),
  { ssr: false },
);
const ImageConvert = dynamic(
  () => import("../components/convertfile/Imageconvert"),
  { ssr: false },
);
const GenerateReport = dynamic(
  () => import("../components/GenerateReport/GenerateReport"),
  { ssr: false },
);
const ImageCropper = dynamic(
  () => import("../components/ImageCropper/ImageCropper"),
  { ssr: false },
);
const ImageRotator = dynamic(
  () => import("../components/ImageRotator/ImageRotator"),
  { ssr: false },
);
const AutoScan = dynamic(
  () => import("../components/AutoScan/AutoScan"),
  { ssr: false },
);
const ImageEditor = dynamic(
  () => import("../components/ImageEditor/ImageEditor"),
  { ssr: false },
);

const theme = createTheme({
  palette: {
    primary: { main: "#f57c00", dark: "#e65100", light: "#ffb74d" },
    secondary: { main: "#1976d2" },
    background: { default: "#f5f7fa" },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    button: { textTransform: "none", fontWeight: 600 },
  },
});

type TabSpec = {
  label: string;
  icon: React.ReactElement;
  Component: React.ComponentType;
};

const MODE_TABS: TabSpec[] = [
  { label: "Decode Image", icon: <QrCodeScannerIcon />, Component: ImageCapture },
  { label: "Auto Scan (Free)", icon: <AutoAwesomeIcon />, Component: AutoScan },
  { label: "Decode Video", icon: <VideocamIcon />, Component: VideoCapture },
  { label: "Generate Report", icon: <DescriptionIcon />, Component: GenerateReport },
  { label: "Convert File", icon: <TransformIcon />, Component: ImageConvert },
  { label: "Edit Image (Crop + Rotate)", icon: <TuneIcon />, Component: ImageEditor },
  { label: "Rotate Image", icon: <RotateRightIcon />, Component: ImageRotator },
  { label: "Crop Image", icon: <CropIcon />, Component: ImageCropper },
];

export default function Home() {
  const [tabIndex, setTabIndex] = useState(0);
  // Lazy-mount tabs but keep them mounted once visited so user state survives switches.
  const [visited, setVisited] = useState<Set<number>>(new Set([0]));

  useEffect(() => {
    setVisited((prev) => {
      if (prev.has(tabIndex)) return prev;
      const next = new Set(prev);
      next.add(tabIndex);
      return next;
    });
  }, [tabIndex]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        <AppBar position="sticky" elevation={3}>
          <Toolbar sx={{ gap: 1.5 }}>
            <QrCodeScannerIcon />
            <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
              Scan Barcode & QR Code
            </Typography>
          </Toolbar>
          <Tabs
            value={tabIndex}
            onChange={(_, idx) => setTabIndex(idx)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            textColor="inherit"
            indicatorColor="secondary"
            sx={{
              bgcolor: "primary.dark",
              "& .MuiTab-root": {
                minHeight: 56,
                fontWeight: 500,
                opacity: 0.85,
              },
              "& .Mui-selected": { opacity: 1 },
              "& .MuiTabs-indicator": { height: 3 },
            }}
          >
            {MODE_TABS.map((tab, i) => (
              <Tab
                key={i}
                label={tab.label}
                icon={tab.icon}
                iconPosition="start"
              />
            ))}
          </Tabs>
        </AppBar>

        <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3 } }}>
          <Paper
            elevation={1}
            sx={{
              p: { xs: 2, sm: 3 },
              minHeight: "calc(100vh - 200px)",
              bgcolor: "background.paper",
            }}
          >
            {MODE_TABS.map((tab, i) => {
              if (!visited.has(i)) return null;
              const Component = tab.Component;
              return (
                <Box
                  key={i}
                  sx={{ display: i === tabIndex ? "block" : "none" }}
                >
                  <Component />
                </Box>
              );
            })}
          </Paper>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
