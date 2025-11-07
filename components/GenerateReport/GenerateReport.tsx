"use client";
import React, { useState } from "react";
import readXlsxFile, { Row } from "read-excel-file";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import {
  Container,
  Typography,
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
} from "@mui/material";

// 🔹 ประกาศ type สำหรับข้อมูล Excel
type ExcelRow = (string | number | boolean | Date | null | undefined)[];

// 🔹 Component หลัก
const Generatereport: React.FC = () => {
  const [projectData, setProjectData] = useState<ExcelRow[]>([]);
  const [inventoryData, setInventoryData] = useState<ExcelRow[]>([]);
  const [report, setReport] = useState<string>("");

  // อ่านไฟล์ Excel
  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    fileType: "project" | "inventory"
  ) => {
    const file = event.target.files?.[0];
    if (!file || !file.name.endsWith(".xlsx")) {
      alert("กรุณาเลือกไฟล์ .xlsx เท่านั้น");
      return;
    }

    readXlsxFile(file)
      .then((rows) => {
        // แปลงค่าที่ไม่ต้องการ เช่น false หรือ DateConstructor ให้เป็น null
        const normalizedRows = rows.map((r) =>
          r.map((c) => (c === false || c === Date ? null : c))
        );

        if (fileType === "project") {
          setProjectData(normalizedRows as ExcelRow[]);
        } else if (fileType === "inventory") {
          setInventoryData(normalizedRows as ExcelRow[]);
        }
      })
      .catch((error) => console.error("เกิดข้อผิดพลาดในการอ่านไฟล์:", error));
  };

  // ฟังก์ชันลบแถว
  const handleDeleteRow = (rowIndex: number) => {
    setProjectData((prevData) => {
      const newData = [...prevData];
      newData.splice(rowIndex + 1, 1); // +1 เพราะข้าม header
      return newData;
    });
  };

  // ฟังก์ชันสร้างรายงาน
  // ฟังก์ชันสร้างรายงาน
  const generateReport = () => {
    let reportText = "";
    let currentBuilding: string | null = null;
    let buildingIndex = 1;
    let subItemIndex = 1;

    projectData.forEach((row) => {
      const [no, detail, quantity, unit] = row;

      if (no === "ลำดับ" || no === "ลำดับที่") return;

      // ถ้ามีเลขลำดับ → แสดงว่าเป็นหัวข้ออาคาร
      if (no && detail) {
        currentBuilding = String(detail);
        reportText += `\n${no}. ${currentBuilding}\n`;
        buildingIndex++;
        subItemIndex = 1;
        return;
      }

      // ถ้าเป็นรายการย่อย (ไม่มีเลขลำดับ แต่มีรายละเอียด)
      if (currentBuilding && detail && !no) {
        // const quantityText = quantity
        //   ? `จำนวน: ${quantity} ${unit}`
        //   : "จำนวน: ไม่ระบุ";
        const d = String(detail).toLowerCase().replace(/\s+/g, " ");

        let foundMatch = false;

        // 🟢 เงื่อนไข: Access Point
        if (d.toLowerCase().includes("wifi")) {
          const accessPoints = inventoryData.filter(
            ([, deviceType, , , , , , , location]) =>
              deviceType &&
              String(deviceType).toLowerCase().includes("access point") &&
              location &&
              String(location).includes(String(currentBuilding))
          );

          if (accessPoints.length > 0) {
            // normalize detail สำหรับ match model
            let dNormalized = String(d).toLowerCase().replace(/\s+/g, "");
            let subSubItemIndex = 1;

            accessPoints.forEach(
              ([, , brand, model, serialNumber, , deviceName, , location]) => {
                if (model) {
                  const modelNormalized = String(model)
                    .toLowerCase()
                    .replace(/\s+/g, "");
                  if (dNormalized.includes(modelNormalized)) {
                    foundMatch = true;
                    reportText += `${
                      buildingIndex - 1
                    }.${subItemIndex}.${subSubItemIndex} ติดตั้ง Access Point ${
                      brand ?? ""
                    } ${model ?? ""} (${deviceName ?? ""}) S/N: ${
                      serialNumber ?? ""
                    }  ${location ?? ""}\n`;
                    subSubItemIndex++;
                  }
                }
              }
            );

            // ถ้าเจอ AP อย่างน้อย 1 ตัว → เพิ่ม subItemIndex
            if (subSubItemIndex > 1) subItemIndex++;
          }
        }

        // 🟢 เงื่อนไข: Switch
        else if (d.includes("switch")) {
          // ดึง switch ใน location ของ currentBuilding
          // console.log("detail sw", d);
          const switches = inventoryData.filter(
            ([, deviceType, , , , , , , location]) =>
              deviceType &&
              String(deviceType).toLowerCase().includes("switch") &&
              location &&
              String(location).includes(String(currentBuilding))
          );

          if (switches.length > 0) {
            // ปรับ d ให้ normalize (lowercase + ลบช่องว่างส่วนเกิน)
            const dNormalized = String(d).toLowerCase().replace(/\s+/g, "");

            let subSubItemIndex = 1; // สำหรับ 3.1.1, 3.1.2
            switches.forEach(
              ([, , brand, model, serialNumber, , deviceName, , location]) => {
                if (model) {
                  // normalize model ด้วย
                  const modelNormalized = String(model)
                    .toLowerCase()
                    .replace(/\s+/g, "");
                  if (dNormalized.includes(modelNormalized)) {
                    foundMatch = true;
                    reportText += `${
                      buildingIndex - 1
                    }.${subItemIndex}.${subSubItemIndex} ติดตั้ง Switch ${
                      brand ?? ""
                    } ${model ?? ""} (${deviceName ?? ""}) S/N: ${
                      serialNumber ?? ""
                    }  ${location ?? ""}\n`;
                    subSubItemIndex++;
                  }
                }
              }
            );

            // ถ้าเจอ switch ตรง model อย่างน้อย 1 ตัว ให้เพิ่ม subItemIndex
            if (subSubItemIndex > 1) subItemIndex++;
          }
        }

        // 🟢 เงื่อนไข: Stabilizer
        else if (d.includes("stabilizer")) {
          const stabilizers = inventoryData.filter(
            ([, deviceType, , model, serialNumber, , deviceName, , location]) =>
              deviceType &&
              String(deviceType).toLowerCase() === "stabilizer" &&
              location &&
              String(location).includes(String(currentBuilding))
          );

          if (stabilizers.length > 0) {
            foundMatch = true;
            stabilizers.forEach(
              ([, , brand, model, serialNumber, , deviceName, , location]) => {
                reportText += `${
                  buildingIndex - 1
                }.${subItemIndex} ติดตั้งเครื่องควบคุมแรงดันไฟฟ้าอัตโนมัติ Stabilizer ${
                  model ?? ""
                } (${deviceName ?? ""}) S/N: ${serialNumber ?? ""} ${
                  location ?? ""
                }\n`;
                subItemIndex++;
              }
            );
          }
        }

        // 🟢 เงื่อนไข: Router / MikroTik
        else if (d.includes("router") || d.includes("mikrotik")) {
          const routers = inventoryData.filter(
            ([, deviceType, , model, serialNumber, , deviceName, , location]) =>
              deviceType &&
              ["router", "mikrotik"].includes(
                String(deviceType).toLowerCase()
              ) &&
              location &&
              String(location).includes(String(currentBuilding))
          );

          if (routers.length > 0) {
            foundMatch = true;
            routers.forEach(
              ([
                ,
                deviceType,
                brand,
                model,
                serialNumber,
                ,
                deviceName,
                ,
                location,
              ]) => {
                reportText += `${
                  buildingIndex - 1
                }.${subItemIndex} ติดตั้ง ${deviceType} ${brand ?? ""} ${
                  model ?? ""
                } (${deviceName ?? ""}) S/N: ${serialNumber ?? ""}  ${
                  location ?? ""
                }\n`;
                subItemIndex++;
              }
            );
          }
        }

        // 🟢 เงื่อนไข: UPS
        else if (d.toLowerCase().includes("ups")) {
          const upsList = inventoryData.filter(
            ([
              ,
              deviceType,
              ,
              model,
              serialNumber,
              ,
              deviceName,
              ,
              location,
            ]) => {
              if (!model) return false;
              const type = String(deviceType ?? "")
                .toLowerCase()
                .trim();
              const loc = String(location ?? "")
                .replace(/\s+/g, "")
                .toLowerCase();
              const currentLoc = String(currentBuilding ?? "")
                .replace(/\s+/g, "")
                .toLowerCase();
              const modelNormalized = String(model ?? "")
                .toLowerCase()
                .replace(/\s+/g, "");
              const detailNormalized = String(detail ?? "")
                .toLowerCase()
                .replace(/\s+/g, "");
              return (
                type.includes("ups") &&
                loc.includes(currentLoc) &&
                detailNormalized.includes(modelNormalized)
              );
            }
          );

          if (upsList.length > 0) {
            foundMatch = true;
            upsList.forEach(
              ([, , brand, model, serialNumber, , deviceName, , location]) => {
                reportText += `${
                  buildingIndex - 1
                }.${subItemIndex} ติดตั้ง UPS ${brand ?? ""} ${model ?? ""} (${
                  deviceName ?? ""
                }) S/N: ${serialNumber ?? ""} ${location ?? ""}\n`;
                subItemIndex++;
              }
            );
          }
        }

        // 🟢 เงื่อนไข: IP Camera
        else if (
          d.toLowerCase().includes("ip") &&
          d.toLowerCase().includes("camera")
        ) {
          const ipCameras = inventoryData.filter(
            ([, deviceType, , model, serialNumber, , deviceName, , location]) =>
              deviceType &&
              String(deviceType).toLowerCase().includes("ip camera") &&
              location &&
              String(location).includes(String(currentBuilding))
          );

          if (ipCameras.length > 0) {
            foundMatch = true;
            let subSubItemIndex = 1;
            ipCameras.forEach(
              ([, , brand, model, serialNumber, , deviceName, , location]) => {
                reportText += `${
                  buildingIndex - 1
                }.${subItemIndex}.${subSubItemIndex} ติดตั้งกล้องพร้อมเดินร้อยท่อ PVC สีขาว IP Camera ${
                  brand ?? ""
                } ${model ?? ""} (${deviceName ?? ""}) S/N: ${
                  serialNumber ?? ""
                } ${location ?? ""}\n`;
                subSubItemIndex++;
              }
            );
            subItemIndex++;
          }
        }

        // 🟢 เงื่อนไข: NVR
        else if (d.toLowerCase().includes("nvr")) {
          const nvrs = inventoryData.filter(
            ([
              ,
              deviceType,
              ,
              model,
              serialNumber,
              ,
              deviceName,
              ,
              location,
            ]) => {
              const type = String(deviceType ?? "").toLowerCase();
              const loc = String(location ?? "")
                .replace(/\s+/g, "")
                .toLowerCase();
              const currentLoc = String(currentBuilding ?? "")
                .replace(/\s+/g, "")
                .toLowerCase();
              return type.includes("nvr") && loc.includes(currentLoc);
            }
          );

          if (nvrs.length > 0) {
            foundMatch = true;
            nvrs.forEach(
              ([, , brand, model, serialNumber, , deviceName, , location]) => {
                reportText += `${
                  buildingIndex - 1
                }.${subItemIndex} ติดตั้งเครื่องบันทึก NVR ${brand ?? ""} ${
                  model ?? ""
                } (${deviceName ?? ""}) S/N: ${serialNumber ?? ""} ${
                  location ?? ""
                }\n`;
                subItemIndex++;
              }
            );
          }
        }

        // ✅ ข้ามหัวข้อที่มีคำเหล่านี้
        else if (
          !d || // ว่าง
          d.includes("ground") ||
          (d.includes("sfp") && d.includes("module")) ||
          (d.includes("patch") && d.includes("cord")) ||
          (d.includes("rack") && d.includes("mount")) ||
          d.includes("ระบบไฟฟ้า")
        ) {
          // console.log("ข้ามหัวข้อ:", detail);
          return; // ข้ามแถวนี้
        }

        // 🟡 ถ้าไม่มีอุปกรณ์ตรงใน Inventory → แสดงไว้และเว้นช่องว่าง
        if (!foundMatch) {
          reportText += `${buildingIndex - 1}.${subItemIndex} ${detail} \n`;
          reportText += `📌 ยังไม่มีข้อมูลใน InventoryData\n`;
          subItemIndex++;
        }
      }
    });

    // จัดชิดซ้ายให้ทั้งหมด (ลบช่องว่างข้างหน้า)
    reportText = reportText
      .split("\n")
      .map((line) => line.trimStart())
      .join("\n");

    setReport(reportText);
  };

  // ส่งออก Word
  const exportToWord = async () => {
    const reportSections = report
      .split("\n")
      .filter((line) => line.trim() !== "");

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: reportSections.map(
            (section) =>
              new Paragraph({
                children: [
                  new TextRun({
                    text: section,
                    font: "TH SarabunPSK",
                    size: 32,
                  }),
                ],
                spacing: { before: 200, after: 200 },
              })
          ),
        },
      ],
    });

    try {
      const blob = await Packer.toBlob(doc);
      saveAs(
        blob,
        `รายงานโครงการ_${new Date().toISOString().slice(0, 10)}.docx`
      );
    } catch (error) {
      console.error("Error exporting Word file:", error);
      alert("เกิดข้อผิดพลาดในการส่งออกไฟล์ Word");
    }
  };

  return (
    <Container
      maxWidth="xl"
      sx={{ py: 4, bgcolor: "grey.50", minHeight: "100vh", padding: "100px" }}
    >
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Upload Files
      </Typography>

      {/* Upload */}
      <Box display="flex" flexDirection={{ xs: "column", sm: "row" }} gap={2}>
        <Box component={Paper} elevation={3} p={2} textAlign="center">
          <Typography variant="h6">Project File</Typography>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={(e) => handleFileUpload(e, "project")}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "8px",
              border: "1px solid #ccc",
            }}
          />
        </Box>
        <Box component={Paper} elevation={3} p={2} textAlign="center">
          <Typography variant="h6">Inventory File</Typography>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={(e) => handleFileUpload(e, "inventory")}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "8px",
              border: "1px solid #ccc",
            }}
          />
        </Box>
      </Box>

      {/* Project Table */}
      {projectData.length > 0 && (
        <Box mt={6}>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Project Data
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  {projectData[0].map((header, idx) => (
                    <TableCell
                      key={idx}
                      sx={{ fontWeight: "medium", bgcolor: "grey.200" }}
                    >
                      {header as string}
                    </TableCell>
                  ))}
                  <TableCell sx={{ fontWeight: "medium", bgcolor: "grey.200" }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projectData.slice(1).map((row, idx) => (
                  <TableRow key={idx} hover>
                    {row.map((cell, cellIdx) => (
                      <TableCell key={cellIdx}>{cell as string}</TableCell>
                    ))}
                    <TableCell>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={() => handleDeleteRow(idx)}
                      >
                        ลบ
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Inventory Table */}
      {inventoryData.length > 0 && (
        <Box mt={6}>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Inventory Data
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  {inventoryData[0].map((header, idx) => (
                    <TableCell
                      key={idx}
                      sx={{ fontWeight: "medium", bgcolor: "grey.200" }}
                    >
                      {header as string}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {inventoryData.slice(1).map((row, idx) => (
                  <TableRow key={idx} hover>
                    {row.map((cell, cellIdx) => (
                      <TableCell key={cellIdx}>{cell as string}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Generate + Export */}
      <Box mt={4}>
        <Button
          variant="contained"
          color="primary"
          fullWidth
          sx={{ py: 1.5, mb: 2 }}
          onClick={generateReport}
        >
          Generate Report
        </Button>

        {report && (
          <Box mt={6} p={4} bgcolor="white" boxShadow={1} borderRadius={2}>
            <Typography
              variant="h6"
              fontWeight="bold"
              gutterBottom
              sx={{ textAlign: "left" }} // ✅ หัวข้อชิดซ้าย
            >
              Generated Report
            </Typography>
            <Box
              sx={{
                whiteSpace: "pre-wrap",
                color: "grey.700",
                bgcolor: "grey.100",
                p: 3,
                borderRadius: 2,
                overflow: "auto",
                fontFamily: "Arial, sans-serif",
                fontSize: "1.5rem",
                textAlign: "left", // ✅ เนื้อหาทั้งหมดชิดซ้าย
              }}
            >
              {report.split("\n").map((line, index) => (
                <div key={index}>{line}</div>
              ))}
            </Box>
            <Button
              onClick={exportToWord}
              variant="contained"
              color="success"
              sx={{ mt: 3 }}
            >
              Export Report to Word
            </Button>
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default Generatereport;
