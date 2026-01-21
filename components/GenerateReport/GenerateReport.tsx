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

  const printedAPBuildings = new Set<string>();
  const apWithCableBuildings = new Set<string>();

  // อ่านไฟล์ Excel
  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    fileType: "project" | "inventory",
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
          r.map((c) => (c === false || c === Date ? null : c)),
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

    projectData.forEach((row, index) => {
      const [no, detail, quantity, unit] = row;

      // 1. ข้าม Header
      if (no === "ลำดับ" || no === "ลำดับที่" || !detail) return;

      // 2. DEBUG: ดูว่าแต่ละแถวถูกมองว่าเป็นอะไร
      console.log(`Row [${index}] check:`, {
        no,
        detail,
        unit,
        type: typeof no,
      });

      // 3. เช็คว่าเป็นหัวข้อตึก (เงื่อนไข: มีเลขลำดับในช่อง no)
      // เราใช้ Number(no) เพื่อเช็คว่ามันเป็นตัวเลข 1, 2, 3 หรือไม่
      if (no !== null && no !== "" && !isNaN(Number(no))) {
        console.log("🟢 Changing Building to:", detail);
        currentBuilding = String(detail).trim();
        reportText += `\n${no}. ${currentBuilding}\n`;
        buildingIndex = Number(no) + 1;
        subItemIndex = 1; // รีเซ็ตลำดับย่อยเมื่อขึ้นตึกใหม่
        return; // จบบรรทัดนี้ ไม่ต้องไปเช็คอุปกรณ์ข้างล่าง
      }

      // ถ้าเป็นรายการย่อย (ไม่มีเลขลำดับ แต่มีรายละเอียด)
      if (currentBuilding && detail && !no) {
        // const quantityText = quantity
        //   ? `จำนวน: ${quantity} ${unit}`
        //   : "จำนวน: ไม่ระบุ";
        const d = String(detail).toLowerCase().replace(/\s+/g, " ");
        console.log(`Checking Item [${index}]:`, d);

        let foundMatch = false;

        const normalize = (s: any) =>
          String(s ?? "")
            .toLowerCase()
            .replace(/\s+/g, "")
            .replace("rg-", "");

        // 🟢 เงื่อนไข: Access Point (ล็อคตึก + แยกตามรุ่น)
        if (
          d.includes("access point") ||
          d.includes("accesspoint") ||
          d.includes("acess point") ||
          d.includes("acesspoint") ||
          d.includes("wifi")
        ) {
          const dNormalized = String(d).toLowerCase().replace(/\s+/g, "");
          const buildingNorm = normalize(currentBuilding);

          console.log("👉 Matched: [ACCESS POINT] Condition");

          const aps = inventoryData
            .slice(1)
            .filter(([, deviceType, , model, , , , , location]) => {
              if (!model) return false;
              const type = normalize(deviceType);
              const loc = normalize(location);
              const modelNorm = normalize(model);

              // ✅ เงื่อนไข 1: เป็น Access Point
              // ✅ เงื่อนไข 2: อยู่ในตึกที่กำลังทำรายงาน (ล็อคตึก)
              // ✅ เงื่อนไข 3: ชื่อรุ่นใน Inventory ต้องมีอยู่ในรายละเอียดของบรรทัดนั้นๆ (ล็อครุ่น)
              return (
                type.includes("accesspoint") &&
                loc.includes(buildingNorm) &&
                dNormalized.includes(modelNorm)
              );
            });

          if (aps.length > 0) {
            foundMatch = true;
            let subSubItemIndex = 1;
            aps.forEach(
              ([, , brand, model, serialNumber, , deviceName, , location]) => {
                reportText += `${
                  buildingIndex - 1
                }.${subItemIndex}.${subSubItemIndex} ติดตั้ง Access Point ${
                  brand ?? ""
                } ${model ?? ""} พร้อมเดินร้อยท่อ PVC สีขาว (${
                  deviceName ?? ""
                }) S/N: ${serialNumber ?? ""} ${location ?? ""}\n`;
                subSubItemIndex++;
              },
            );
            subItemIndex++;
          }
        }

        // 🟡 งานเดินสาย + ติดตั้ง Access Point → ใช้เป็น description เท่านั้น
        else if (d.includes("ติดตั้งสาย") && d.includes("access point")) {
          apWithCableBuildings.add(currentBuilding!);
          return; // ❌ ไม่แสดงเป็นหัวข้อ
        }

        // 🟢 เงื่อนไข: Controller (OC200, OC220, OC300)
        else if (
          (d.includes("controller") ||
            d.includes("oc200") ||
            d.includes("oc220") ||
            d.includes("oc300")) &&
          !d.includes("switch") && // ❌ ต้องไม่มีคำว่า switch
          !d.includes("access point") && // ❌ ต้องไม่มีคำว่า access point
          !d.includes("router") // ❌ ต้องไม่มีคำว่า router
        ) {
          const dNormalized = String(d).toLowerCase().replace(/\s+/g, "");

          console.log("👉 Matched: [CONTROLLER] Condition");

          const controllers = inventoryData.filter(
            ([, deviceType, , model, , , , , location]) => {
              if (!model) return false;
              const type = normalize(deviceType);
              const loc = normalize(location);
              const building = normalize(currentBuilding);
              const modelNorm = normalize(model);

              // เช็คว่าเป็น Controller + อยู่ตึกเดียวกัน + Model ตรงกับใน Project Detail
              return (
                (type.includes("controller") || type.includes("omada")) &&
                loc.includes(building) &&
                dNormalized.includes(modelNorm)
              );
            },
          );

          if (controllers.length > 0) {
            foundMatch = true;
            controllers.forEach(
              ([, , brand, model, serialNumber, , deviceName, , location]) => {
                reportText += `${
                  buildingIndex - 1
                }.${subItemIndex} ติดตั้งอุปกรณ์บริหารจัดการระบบเครือข่าย (Controller) ${
                  brand ?? ""
                } ${model ?? ""} (${deviceName ?? ""}) S/N: ${
                  serialNumber ?? ""
                } ${location ?? ""}\n`;
                subItemIndex++;
              },
            );
          }
        }

        // 🟢 เงื่อนไข: Switch
        else if (d.includes("switch")) {
          const dNormalized = String(d).toLowerCase().replace(/\s+/g, "");
          const buildingNorm = normalize(currentBuilding);

          console.log("👉 Matched: [SWITCH] Condition");

          // LOG เพื่อเช็คว่าตอนนี้โปรแกรมมองว่าเราอยู่ตึกไหน และกำลังเทียบกับข้อความอะไร
          console.log("--- Checking Switch ---");
          console.log("Current Building Value:", currentBuilding);
          console.log("Building Normalized:", buildingNorm);
          console.log("Project Detail Normalized:", dNormalized);

          const switches = inventoryData.slice(1).filter((row) => {
            const [
              no,
              deviceType,
              brand,
              model,
              serial,
              mac,
              name,
              ip,
              location,
            ] = row;
            if (!model) return false;

            const typeNorm = normalize(deviceType);
            const locNorm = normalize(location);
            const modelNorm = normalize(model);

            const matchType = typeNorm.includes("switch");
            const matchLoc = locNorm.includes(buildingNorm);
            const matchModel = dNormalized.includes(modelNorm);

            // LOG ทุกตัวใน Inventory ที่เป็น Switch เพื่อดูว่าติดเงื่อนไขไหน
            if (matchType) {
              console.log(`Checking Inv Row [${model}]:`, {
                "1.Type Match": matchType,
                "2.Location Match": matchLoc, // <--- ถ้าตัวนี้ False แสดงว่าปัญหาอยู่ที่ชื่อตึก
                "3.Model Match": matchModel,
                Values: { locNorm, buildingNorm, modelNorm },
              });
            }

            return matchType && matchLoc && matchModel;
          });

          if (switches.length > 0) {
            foundMatch = true;
            let subSubItemIndex = 1;
            switches.forEach(
              ([, , brand, model, serialNumber, , deviceName, , location]) => {
                reportText += `${
                  buildingIndex - 1
                }.${subItemIndex}.${subSubItemIndex} ติดตั้ง Switch ${
                  brand ?? ""
                } ${model ?? ""} (${deviceName ?? ""}) S/N: ${
                  serialNumber ?? ""
                } ${location ?? ""}\n`;
                subSubItemIndex++;
              },
            );
            subItemIndex++;
          }
        }

        // 🟢 เงื่อนไข: IP Phone
        else if (
          d.includes("ip phone") ||
          d.includes("ipphone") ||
          d.includes("telephone")
        ) {
          const dNormalized = String(d).toLowerCase().replace(/\s+/g, "");
          const buildingNorm = normalize(currentBuilding);

          console.log("👉 Matched: [IP PHONE] Condition");

          // LOG Debug แบบเดียวกับ Switch
          console.log("--- Checking IP Phone ---");
          console.log("Current Building Value:", currentBuilding);
          console.log("Building Normalized:", buildingNorm);
          console.log("Project Detail Normalized:", dNormalized);

          const phones = inventoryData.slice(1).filter((row) => {
            const [
              no,
              deviceType,
              brand,
              model,
              serial,
              mac,
              name,
              ip,
              location,
            ] = row;

            if (!model) return false;

            const typeNorm = normalize(deviceType);
            const locNorm = normalize(location);
            const modelNorm = normalize(model);

            // 1. เช็คประเภทอุปกรณ์ (ครอบคลุมทั้ง IP Phone และ Telephone)
            const matchType =
              typeNorm.includes("phone") ||
              typeNorm.includes("ipphone") ||
              typeNorm.includes("telephone");

            // 2. เช็คสถานที่ (ตึก)
            const matchLoc = locNorm.includes(buildingNorm);

            // 3. เช็ครุ่น (ข้อความใน Project ต้องมีชื่อรุ่นระบุอยู่)
            const matchModel = dNormalized.includes(modelNorm);

            // LOG Debug รายตัว (ถ้าต้องการดูละเอียด ให้ Uncomment)
            /*
              if (matchType) {
                 console.log(`Checking Phone [${model}]:`, {
                    MatchType: matchType,
                    MatchLoc: matchLoc,
                    MatchModel: matchModel
                 });
              }
              */

            return matchType && matchLoc && matchModel;
          });

          if (phones.length > 0) {
            foundMatch = true;
            let subSubItemIndex = 1;
            phones.forEach(
              ([, , brand, model, serialNumber, , deviceName, , location]) => {
                reportText += `${
                  buildingIndex - 1
                }.${subItemIndex}.${subSubItemIndex} ติดตั้งเครื่องโทรศัพท์ IP Phone ${
                  brand ?? ""
                } ${model ?? ""} (${deviceName ?? ""}) S/N: ${
                  serialNumber ?? ""
                } ${location ?? ""}\n`;
                subSubItemIndex++;
              },
            );
            subItemIndex++;
          }
        }

        // 🟢 เงื่อนไข: Stabilizer
        else if (d.includes("stabilizer")) {
          const stabilizers = inventoryData.filter(
            ([, deviceType, , model, serialNumber, , deviceName, , location]) =>
              deviceType &&
              String(deviceType).toLowerCase() === "stabilizer" &&
              location &&
              String(location).includes(String(currentBuilding)),
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
              },
            );
          }
        }

        // 🟢 เงื่อนไข: Router (ทำงานเหมือน Switch)
        else if (d.includes("router")) {
          // ดึง router เฉพาะอาคารปัจจุบัน
          const routers = inventoryData.filter(
            ([, deviceType, , , , , , , location]) =>
              deviceType &&
              String(deviceType).toLowerCase().includes("router") &&
              location &&
              String(location).includes(String(currentBuilding)),
          );

          if (routers.length > 0) {
            // normalize รายละเอียดเหมือน Switch
            const dNormalized = String(d).toLowerCase().replace(/\s+/g, "");

            let subSubItemIndex = 1;

            routers.forEach(
              ([, , brand, model, serialNumber, , deviceName, , location]) => {
                if (model) {
                  const modelNormalized = String(model)
                    .toLowerCase()
                    .replace(/\s+/g, "");

                  // ⭐ match “model” เหมือน Switch
                  if (dNormalized.includes(modelNormalized)) {
                    foundMatch = true;

                    reportText += `${
                      buildingIndex - 1
                    }.${subItemIndex}.${subSubItemIndex} ติดตั้ง Router ${
                      brand ?? ""
                    } ${model ?? ""} (${deviceName ?? ""}) S/N: ${
                      serialNumber ?? ""
                    } ${location ?? ""}\n`;

                    subSubItemIndex++;
                  }
                }
              },
            );

            // มี match -> เพิ่มลำดับ
            if (subSubItemIndex > 1) subItemIndex++;
          }
        }

        // 🟢 เงื่อนไข: UPS
        else if (d.toLowerCase().includes("ups")) {
          console.log("👉 Matched: [UPS] Condition");
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
            },
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
              },
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
              String(location).includes(String(currentBuilding)),
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
              },
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
            },
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
              },
            );
          }
        } else if (
          d.includes("outlet") &&
          (d.includes("lan") || d.includes("โทรศัพท์"))
        ) {
          console.log("👉 Matched: [OUTLET] Condition");
          foundMatch = true;

          const qty = Number(quantity ?? 1);

          // ❗ ใช้ detail ต้นฉบับในการเช็ค TEL / LAN
          const raw = String(detail).toLowerCase();

          // ตรวจสอบว่าเป็นโทรศัพท์หรือไม่
          const isTel =
            raw.includes("โทรศัพท์") ||
            raw.includes("เบอร์โทร") ||
            raw.includes("สำหรับโทรศัพท์") ||
            raw.includes("tel") ||
            raw.includes("telephone") ||
            raw.includes("phone");

          // ตั้งประเภท Outlet
          // ถ้าเป็นโทรศัพท์ → ใช้คำว่า “สำหรับโทรศัพท์”
          // ถ้าไม่ใช่ → ใช้ LAN ตามปกติ
          const outletType = isTel ? "สำหรับโทรศัพท์" : "LAN";

          // ชื่อ Outlet เช่น LAN01
          const outletLabel = isTel ? "TEL" : "LAN";

          // 🟢 หัวข้อหลัก
          reportText += `${
            buildingIndex - 1
          }.${subItemIndex} ติดตั้งสาย UTP CAT-6 Indoor แบบเหมาจุดรวมของ พร้อมติดตั้ง Outlet ${outletType} (เดินร้อยท่อ PVC สีขาว)\n`;

          // 🟢 แตกหัวข้อย่อย
          let subSubItemIndex = 1;
          for (let i = 0; i < qty; i++) {
            reportText += `${
              buildingIndex - 1
            }.${subItemIndex}.${subSubItemIndex} ติดตั้ง Outlet ${outletType} (${outletLabel}${
              i + 1
            })\n`;
            subSubItemIndex++;
          }

          subItemIndex++;
        }

        // ✅ ข้ามหัวข้อที่มีคำเหล่านี้
        else if (
          !d || // ว่าง
          d.includes("ground") ||
          (d.includes("sfp") && d.includes("module")) ||
          (d.includes("patch") && d.includes("cord")) ||
          (d.includes("rack") && d.includes("mount")) ||
          d.includes("ระบบไฟฟ้า") ||
          (d.includes("utp") && d.includes("access point")) ||
          (d.includes("รางไฟ") && d.includes("outlet"))
        ) {
          // console.log("ข้ามหัวข้อ:", detail);
          console.log("👉 Matched: [SKIP] Condition (Ignored Item)");
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
              }),
          ),
        },
      ],
    });

    try {
      const blob = await Packer.toBlob(doc);
      saveAs(
        blob,
        `รายงานโครงการ_${new Date().toISOString().slice(0, 10)}.docx`,
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
