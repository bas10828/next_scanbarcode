import React, { useRef, useEffect, MutableRefObject, useCallback, useState } from "react";
import "../../dynamsoft.config";
import { EnumCapturedResultItemType } from "dynamsoft-core";
import { BarcodeResultItem } from "dynamsoft-barcode-reader";
import { CaptureVisionRouter } from "dynamsoft-capture-vision-router";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Select, MenuItem,FormControl,InputLabel, TextField ,Button} from "@mui/material";
import { styled } from "@mui/material/styles";
import * as XLSX from "xlsx";
// import "./ImageCapture.css"

const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  marginTop: theme.spacing(2),
  maxWidth: "100%",
  marginLeft: "auto",
  marginRight: "auto",
  overflowX: 'auto',
}));

const StyledTableHead = styled(TableHead)(({ theme }) => ({
  backgroundColor: theme.palette.primary.light,
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  fontWeight: 'bold',
  border: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(1),
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
  '&:nth-of-type(even)': {
    backgroundColor: theme.palette.background.default,
  },
}));

interface BarcodeResult {
  fileName: string;
  barcodeText: string[];
}

function formatMacAddress(mac: string) {
  return mac.match(/.{1,2}/g)?.join(":").toUpperCase() || mac;
}

function ImageCapture() {
  const [barcodeResults, setBarcodeResults] = useState<BarcodeResult[]>([]);
  const [brandSelections, setBrandSelections] = useState<{ [key: number]: string }>({});
  const [serials, setSerials] = useState<{ [key: number]: string }>({});
  const [macs, setMacs] = useState<{ [key: number]: string }>({});
  const [mac_s, setMac_s] = useState<{ [key: number]: string }>({});
  const [models, setModels] = useState<{ [key: number]: string }>({}); // เพิ่ม State สำหรับ Model

  let pCvRouter: MutableRefObject<Promise<CaptureVisionRouter> | null> = useRef(null);
  let isDestroyed = useRef(false);

  const decodeImg = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    let files = [...(e.target.files as any as File[])];
    e.target.value = "";
    setBarcodeResults([]);

    try {
      const cvRouter = await (pCvRouter.current = pCvRouter.current || CaptureVisionRouter.createInstance());
      if (isDestroyed.current) return;

      const results: BarcodeResult[] = [];
      for (let file of files) {
        const result = await cvRouter.capture(file, "ReadBarcodes_SpeedFirst");
        if (isDestroyed.current) return;

        const barcodes = result.items
          .filter(item => item.type === EnumCapturedResultItemType.CRIT_BARCODE)
          .map(item => (item as BarcodeResultItem).text);

        if (barcodes.length === 0) {
          results.push({ fileName: file.name, barcodeText: ["No barcode found"] });
        } else {
          results.push({ fileName: file.name, barcodeText: barcodes });
        }
      }
      setBarcodeResults(results);
    } catch (ex: any) {
      let errMsg = ex.message || ex;
      console.error(errMsg);
      alert(errMsg);
    }
  }, []);

  useEffect((): any => {
    isDestroyed.current = false;
    return async () => {
      isDestroyed.current = true;
      if (pCvRouter.current) {
        try {
          (await pCvRouter.current).dispose();
        } catch (_) { }
      }
    };
  }, []);

  const handleBrandChange = (index: number, value: string) => {
    setBrandSelections((prev) => ({ ...prev, [index]: value }));

    let sn = "";
    let mac = "non";
    let mac_ = "";
    let model = ""; // ตัวแปรสำหรับ Model

    if (value === 'unifi') {
      const ubiquitiData = barcodeResults[index].barcodeText[0]; // ใช้ barcodeText ตัวแรก
      const macPattern = /\b[A-F0-9]{12}\b/;

      sn = ubiquitiData.substring(0, 19);
      const first12Chars = ubiquitiData.substring(0, 12);

      if (macPattern.test(first12Chars)) {
        mac = formatMacAddress(first12Chars);
        mac_ = first12Chars;
      }
    } else if (value === 'reyee') {
      const reyeeData = barcodeResults[index].barcodeText.join(" "); // ใช้ barcodeText ทั้งหมดรวมกัน
      const urlPattern = /http:\/\/rj\.link\/e\?s=([^&]+)&d=([^&]+)&m=([A-F0-9]{12})/;
      const match = urlPattern.exec(reyeeData);

      if (match) {
        sn = match[1];
        model = match[2]; // กำหนดค่า Model จากข้อมูลที่พบ
        mac = formatMacAddress(match[3]);
        mac_ = match[3];
      } else {
        const snPattern = /(\b(?:CA|G1|ZA|AH)[A-Z0-9]{11}\b)/;
        const macPattern = /\b[A-F0-9]{12}\b/;

        const snMatch = reyeeData.match(snPattern);
        sn = snMatch ? snMatch[0] : 'non';

        const macMatches = reyeeData.match(macPattern);
        if (macMatches) {
          const foundMac = macMatches.find(mac => mac.length === 12);
          mac = foundMac ? formatMacAddress(foundMac) : 'non';
          mac_ = foundMac || 'non';
        }

      }
    }

    setSerials((prev) => ({ ...prev, [index]: sn }));
    setMacs((prev) => ({ ...prev, [index]: mac }));
    setMac_s((prev) => ({ ...prev, [index]: mac_ }));
    setModels((prev) => ({ ...prev, [index]: model })); // เก็บค่า Model ใน State
  };

  const handleSelectAll = (brand: string) => {
    barcodeResults.forEach((_, index) => handleBrandChange(index, brand));
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(barcodeResults.map((result, index) => ({
      FileName: result.fileName,
      BarcodeText: result.barcodeText.join(", "),
      Brand: brandSelections[index] || "",
      Serial: serials[index] || "",
      Model: models[index] || "",
      MAC: macs[index] || "",
      MAC_: mac_s[index] || ""
    })));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Barcode Results");
    
    XLSX.writeFile(wb, "barcode_results.xlsx");
  };

  return (
    <div className="image-capture-container">
      <div className="input-container">
        <input type="file" multiple accept=".jpg,.jpeg,.icon,.gif,.svg,.webp,.png,.bmp" onChange={decodeImg} />
      </div>

      <div className=" ">
        <FormControl variant="outlined" fullWidth>
          <InputLabel>Select Brand</InputLabel>
          <Select
            onChange={(e) => handleSelectAll(e.target.value as string)}
            label="Select Brand"
          >
            <MenuItem value="reyee">Select All Reyee</MenuItem>
            <MenuItem value="unifi">Select All Unifi</MenuItem>
            <MenuItem value="tp-link">Select All TP-Link</MenuItem>
          </Select>
        </FormControl>
      </div>

      <StyledTableContainer>
        <Table>
          <StyledTableHead>
            <TableRow>
              <StyledTableCell>File Name</StyledTableCell>
              <StyledTableCell>Barcode Text</StyledTableCell>
              <StyledTableCell>Brand</StyledTableCell>
              <StyledTableCell>Serial</StyledTableCell>
              <StyledTableCell>Model</StyledTableCell> {/* เพิ่มคอลัมน์ Model */}
              <StyledTableCell>MAC</StyledTableCell>
              <StyledTableCell>MAC_</StyledTableCell>
            </TableRow>
          </StyledTableHead>
          <TableBody>
            {barcodeResults.map((result, index) => (
              <StyledTableRow key={index}>
                <StyledTableCell>{result.fileName}</StyledTableCell>
                <StyledTableCell>{result.barcodeText.join(", ")}</StyledTableCell>
                <StyledTableCell>
                  <Select
                    value={brandSelections[index] || ""}
                    onChange={(e) => handleBrandChange(index, e.target.value)}
                  >
                    <MenuItem value="reyee">Reyee</MenuItem>
                    <MenuItem value="unifi">Unifi</MenuItem>
                    <MenuItem value="tp-link">TP-Link</MenuItem>
                  </Select>
                </StyledTableCell>
                <StyledTableCell>
                  <div className="table-cell-text">
                    {serials[index] || ""}
                  </div>
                </StyledTableCell>
                <StyledTableCell> {/* เพิ่มการแสดงผล Model */}
                  <div className="table-cell-text">
                    {models[index] || ""}
                  </div>
                </StyledTableCell>
                <StyledTableCell>
                  <div className="table-cell-text">
                    {macs[index] || ""}
                  </div>
                </StyledTableCell>
                <StyledTableCell>
                  <div className="table-cell-text">
                    {mac_s[index] || ""}
                  </div>
                </StyledTableCell>
              </StyledTableRow>
            ))}
          </TableBody>

        </Table>
      </StyledTableContainer>
      <div className="export-container">
        <Button
          variant="contained"
          color="primary"
          onClick={exportToExcel}
          style={{ marginTop: "20px" }}
        >
          Export to Excel
        </Button>
      </div>
    </div>
  );
}

export default ImageCapture;
