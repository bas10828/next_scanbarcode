"use client";
import React, { useRef, useState } from "react";
import readXlsxFile from "read-excel-file";
import {
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Stack,
  Card,
  Chip,
  IconButton,
  Tooltip,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import DescriptionIcon from "@mui/icons-material/Description";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { ExcelRow } from "./types";
import { generateReportText } from "./reportGenerator";
import { exportReportToWord } from "./wordExport";

type FileKind = "project" | "inventory";

const FILE_CONFIG = {
  project: { label: "Project File", color: "#eff6ff", border: "#bfdbfe", chip: "primary" as const },
  inventory: { label: "Inventory File", color: "#f0fdf4", border: "#bbf7d0", chip: "success" as const },
};

const GenerateReport: React.FC = () => {
  const [projectData, setProjectData] = useState<ExcelRow[]>([]);
  const [inventoryData, setInventoryData] = useState<ExcelRow[]>([]);
  const [projectName, setProjectName] = useState("");
  const [inventoryName, setInventoryName] = useState("");
  const [report, setReport] = useState<string>("");
  const projectRef = useRef<HTMLInputElement>(null);
  const inventoryRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    kind: FileKind,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !file.name.match(/\.xlsx?$/i)) {
      alert("กรุณาเลือกไฟล์ .xlsx เท่านั้น");
      return;
    }
    if (kind === "project") setProjectName(file.name);
    else setInventoryName(file.name);

    readXlsxFile(file)
      .then((rows) => {
        const normalized = rows.map((r) =>
          r.map((c) => (c === false || c === Date ? null : c)),
        ) as ExcelRow[];
        if (kind === "project") setProjectData(normalized);
        else setInventoryData(normalized);
      })
      .catch((err) => console.error("เกิดข้อผิดพลาดในการอ่านไฟล์:", err));

    event.target.value = "";
  };

  const handleDeleteRow = (rowIndex: number) => {
    setProjectData((prev) => {
      const next = [...prev];
      next.splice(rowIndex + 1, 1);
      return next;
    });
  };

  const handleGenerate = () => {
    setReport(generateReportText(projectData, inventoryData));
  };

  const handleExportWord = async () => {
    try {
      await exportReportToWord(report);
    } catch (err) {
      console.error("Error exporting Word file:", err);
      alert("เกิดข้อผิดพลาดในการส่งออกไฟล์ Word");
    }
  };

  return (
    <Stack spacing={3}>
      {/* File upload section */}
      <Box
        display="grid"
        gridTemplateColumns={{ xs: "1fr", sm: "repeat(2, 1fr)" }}
        gap={2}
      >
        {(["project", "inventory"] as const).map((kind) => {
          const cfg = FILE_CONFIG[kind];
          const name = kind === "project" ? projectName : inventoryName;
          const hasData = kind === "project" ? projectData.length > 0 : inventoryData.length > 0;
          const ref = kind === "project" ? projectRef : inventoryRef;

          return (
            <Card
              key={kind}
              onClick={() => ref.current?.click()}
              sx={{
                p: 2.5,
                bgcolor: cfg.color,
                border: "2px dashed",
                borderColor: hasData ? cfg.border : "grey.300",
                borderRadius: 2,
                cursor: "pointer",
                transition: "all 0.2s",
                "&:hover": { borderColor: cfg.border, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
              }}
            >
              <Box display="flex" alignItems="center" gap={1.5}>
                <UploadFileIcon sx={{ color: hasData ? "primary.main" : "grey.400", fontSize: 28 }} />
                <Box flex={1}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {cfg.label}
                  </Typography>
                  {name ? (
                    <Chip
                      label={name}
                      size="small"
                      color={cfg.chip}
                      sx={{ mt: 0.5, maxWidth: "100%", fontSize: "0.7rem" }}
                    />
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      คลิกเพื่อเลือกไฟล์ .xlsx
                    </Typography>
                  )}
                </Box>
              </Box>
              <input
                ref={ref}
                type="file"
                accept=".xlsx,.xls"
                hidden
                onChange={(e) => handleFileUpload(e, kind)}
              />
            </Card>
          );
        })}
      </Box>

      {projectData.length > 0 && (
        <DataTable title="Project Data" data={projectData} onDeleteRow={handleDeleteRow} />
      )}
      {inventoryData.length > 0 && (
        <DataTable title="Inventory Data" data={inventoryData} />
      )}

      <Button
        variant="contained"
        color="primary"
        size="large"
        fullWidth
        onClick={handleGenerate}
        startIcon={<AutoAwesomeIcon />}
        disabled={projectData.length === 0 && inventoryData.length === 0}
        sx={{ py: 1.5 }}
      >
        Generate Report
      </Button>

      {report && (
        <Card
          variant="outlined"
          sx={{ p: 3, bgcolor: "#fffbf7", borderColor: "#fed7aa" }}
        >
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <DescriptionIcon sx={{ color: "primary.main" }} />
            <Typography variant="h6" fontWeight={700}>
              Generated Report
            </Typography>
          </Box>

          <Box
            sx={{
              whiteSpace: "pre-wrap",
              bgcolor: "white",
              border: "1px solid",
              borderColor: "grey.200",
              borderRadius: 1.5,
              p: 2.5,
              fontFamily: "Arial, sans-serif",
              fontSize: "0.95rem",
              color: "grey.800",
              lineHeight: 1.8,
              overflow: "auto",
              maxHeight: "60vh",
            }}
          >
            {report.split("\n").map((line, i) => (
              <div key={i}>{line || " "}</div>
            ))}
          </Box>

          <Button
            onClick={handleExportWord}
            variant="contained"
            color="success"
            startIcon={<DescriptionIcon />}
            sx={{ mt: 2 }}
          >
            Export to Word
          </Button>
        </Card>
      )}
    </Stack>
  );
};

type DataTableProps = {
  title: string;
  data: ExcelRow[];
  onDeleteRow?: (rowIndex: number) => void;
};

const DataTable: React.FC<DataTableProps> = ({ title, data, onDeleteRow }) => (
  <Box>
    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
      {title}
      <Chip
        label={`${data.length - 1} rows`}
        size="small"
        sx={{ ml: 1, fontSize: "0.7rem" }}
      />
    </Typography>
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ borderRadius: 1.5, overflow: "hidden" }}
    >
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: "grey.100" }}>
            {data[0].map((header, idx) => (
              <TableCell key={idx} sx={{ fontWeight: 700, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                {header as string}
              </TableCell>
            ))}
            {onDeleteRow && (
              <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem" }}>Actions</TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.slice(1).map((row, idx) => (
            <TableRow key={idx} hover sx={{ "&:last-child td": { border: 0 } }}>
              {row.map((cell, cellIdx) => (
                <TableCell key={cellIdx} sx={{ fontSize: "0.82rem" }}>
                  {cell as string}
                </TableCell>
              ))}
              {onDeleteRow && (
                <TableCell>
                  <Tooltip title="ลบแถวนี้">
                    <IconButton size="small" color="error" onClick={() => onDeleteRow(idx)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  </Box>
);

export default GenerateReport;
