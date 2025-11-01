"use client";
import React, { useState } from "react";
import {
  Container,
  Typography,
  Button,
  CircularProgress,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteIcon from "@mui/icons-material/Delete";
import readXlsxFile from "read-excel-file";

interface RowData {
  no: string;
  item: string;
  qty: string;
  unit: string;
}

const GenerateReport: React.FC = () => {
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const dataFromExcel = await readXlsxFile(file);
      const data: RowData[] = [];

      dataFromExcel.forEach((row: any[], index: number) => {
        if (index === 0) return; // skip header
        const [no, item, qty, unit] = row;
        if (!no && !item) return; // skip empty lines
        data.push({
          no: no ? String(no) : "",
          item: item ? String(item) : "",
          qty: qty ? String(qty) : "",
          unit: unit ? String(unit) : "",
        });
      });

      setRows(data);
    } catch (err) {
      console.error("Error reading Excel:", err);
      alert("เกิดข้อผิดพลาดในการอ่านไฟล์ Excel");
    } finally {
      setLoading(false);
      event.target.value = ""; // reset input เพื่อเลือกไฟล์ซ้ำได้
    }
  };

  // ✅ ฟังก์ชันลบแถว
  const handleDeleteRow = (index: number) => {
    setRows((prevRows) => prevRows.filter((_, i) => i !== index));
  };

  return (
    <Container
      maxWidth="lg"
      sx={{
        mt: 4,
        mb: 4,
        p: 3,
        backgroundColor: "white",
        borderRadius: 2,
        boxShadow: 2,
      }}
    >
      <Typography variant="h4" align="center" gutterBottom>
        📊 Generate Report
      </Typography>

      {/* ปุ่มเลือกไฟล์ */}
      <Box textAlign="center" mt={2} mb={3}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<UploadFileIcon />}
          onClick={() => document.getElementById("excel-input")?.click()}
        >
          Price Estimation Sheet
        </Button>
        <input
          id="excel-input"
          type="file"
          accept=".xlsx, .xls"
          style={{ display: "none" }}
          onChange={handleExcelUpload}
        />
      </Box>

      {/* โหลดอยู่ */}
      {loading && (
        <CircularProgress sx={{ display: "block", margin: "20px auto" }} />
      )}

      {/* ตาราง */}
      {!loading && rows.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead sx={{ backgroundColor: "#f5f5f5" }}>
              <TableRow>
                <TableCell align="center" sx={{ fontWeight: "bold" }}>
                  ลำดับที่
                </TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>
                  รายการของที่คาดว่าจะใช้งาน
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: "bold" }}>
                  จำนวน
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: "bold" }}>
                  หน่วย
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: "bold" }}>
                  ลบ
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell align="center">{row.no}</TableCell>
                  <TableCell>{row.item}</TableCell>
                  <TableCell align="center">{row.qty}</TableCell>
                  <TableCell align="center">{row.unit}</TableCell>
                  <TableCell align="center">
                    <IconButton
                      color="error"
                      onClick={() => handleDeleteRow(index)}
                      aria-label="delete row"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ถ้ายังไม่มีไฟล์ */}
      {!loading && rows.length === 0 && (
        <Typography align="center" color="text.secondary" mt={4}>
          📂 กรุณาเลือกไฟล์ Excel (ใบประเมินราคา)
        </Typography>
      )}
    </Container>
  );
};

export default GenerateReport;
