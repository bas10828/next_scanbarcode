"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import "../../dynamsoft.config";
import { EnumCapturedResultItemType } from "dynamsoft-core";
import { CaptureVisionRouter } from "dynamsoft-capture-vision-router";
import { Container, Box, Button, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Select, MenuItem, InputLabel, FormControl } from "@mui/material";
import { styled } from '@mui/material/styles';
import * as XLSX from 'xlsx'; // Import the xlsx library
import "./page.module.css";

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.common.white,
  fontWeight: 'bold',
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(even)': {
    backgroundColor: theme.palette.action.hover,
  },
}));

export default () => {
  const resDiv = useRef(null);
  const [results, setResults] = useState([]);
  const [brandSelections, setBrandSelections] = useState({});
  const [scannedData, setScannedData] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('');

  const pCvRouter = useRef(null);
  const bDestoried = useRef(false);

    const captureImage = useCallback(async (e) => {
    let files = Array.from(e.target.files);
    e.target.value = '';
    if (resDiv.current) {
      resDiv.current.innerText = "";
    }

    try {
      const cvRouter = await (pCvRouter.current = pCvRouter.current || CaptureVisionRouter.createInstance());
      if (bDestoried.current) return;

      const tempResults = [];

      for (let file of files) {
        // Decode selected image with 'ReadBarcodes_SpeedFirst' template.
        const result = await cvRouter.capture(file, "ReadBarcodes_SpeedFirst");

        if (bDestoried.current) return;

        if (files.length > 1 && resDiv.current) {
          resDiv.current.innerText += `\n${file.name}:\n`;
        }

        let scannedDataForFile = { fileName: file.name, scannedData: '' };

        for (let _item of result.items) {
          if (_item.type !== EnumCapturedResultItemType.CRIT_BARCODE) {
            continue;
          }
          let item = _item.text;
          scannedDataForFile.scannedData += `${item}\n`; // Append scanned data
        }

        tempResults.push(scannedDataForFile);

        if (!result.items.length && resDiv.current) {
          resDiv.current.innerText += 'No barcode found\n';
        }
      }

      setScannedData(tempResults);
    } catch (ex) {
      let errMsg = ex.message || ex;
      console.error(errMsg);
      alert(errMsg);
    }
  }, []);


  useEffect(() => {
    // reset value so works in React.StrictMode
    bDestoried.current = false;
    // onBeforeUnmount
    return async () => {
      console.log('destroy???'); // debug
      bDestoried.current = true;
      if (pCvRouter.current) {
        try {
          (await pCvRouter.current).dispose();
        } catch (_) { }
      }
    };
  }, []);

  useEffect(() => {
    const classifyResults = () => {
      const updatedResults = scannedData.map(result => {
        const brand = brandSelections[result.fileName];
        let sn = 'non';
        let mac = 'non';
        let model = 'non';

        switch (brand) {
          case 'reyee':
            // เช็คว่า result.scannedData มีลิงก์ในรูปแบบที่กำหนด
            const urlPattern = /http:\/\/rj\.link\/e\?s=([^&]+)&d=([^&]+)&m=([A-F0-9]{12})/;
            const match = urlPattern.exec(result.scannedData);

            if (match) {
              // ถ้าลิงก์ตรงตามรูปแบบที่กำหนด
              sn = match[1];  // ค่า S/N จาก URL
              model = match[2]; // ค่า Model จาก URL
              mac = formatMacAddress(match[3]);  // ค่า MAC จาก URL
            } else {
              // ใช้แพทเทิร์นเพื่อจำแนก S/N และ MAC
              const snPattern = /(\b(?:CA|G1|ZA|AH)[A-Z0-9]{11}\b)/;
              const macPattern = /\b[A-F0-9]{12}\b/;

              // ตรวจสอบ S/N
              const snMatch = result.scannedData.match(snPattern);
              sn = snMatch ? snMatch[0] : 'non';

              // ตรวจสอบ MAC Address
              const macMatches = result.scannedData.match(macPattern);
              mac = macMatches ? formatMacAddress(macMatches.find(mac => mac.length === 12)) || 'non' : 'non';
            }
            break;

          case 'UniFi':
            // แยกข้อมูลสำหรับ Ubiquiti
            const ubiquitiData = result.scannedData;
            sn = ubiquitiData; // ทั้งหมดเป็น S/N
            mac = formatMacAddress(ubiquitiData.substring(0, 12)); // 12 ตัวแรกเป็น MAC
            break;

          case 'tp-link':
            console.log("TP-Link")
            // แยกข้อมูลสำหรับ TP-Link
            const tpLinkData = result.scannedData;
            const tpLinkSnPattern = /\b22[A-Z0-9]{11}\b/;
            const tpLinkMacPattern = /\b[A-F0-9]{12}\b/;

            // ตรวจสอบ S/N ที่ขึ้นต้นด้วย 22 และมี 13 ตัว
            const snMatch = tpLinkData.match(tpLinkSnPattern);
            sn = snMatch ? snMatch[0] : 'non';

            // ตรวจสอบ MAC Address ที่มี 12 ตัว
            const macMatches = tpLinkData.match(tpLinkMacPattern);
            mac = macMatches ? formatMacAddress(macMatches.find(mac => mac.length === 12)) || 'non' : 'non';
            break;

          default:
            // กรณีอื่น ๆ ที่ไม่ได้จัดการ
            break;
        }

        return {
          ...result,
          sn,
          mac,
          model
        };
      });

      setResults(updatedResults);
    };

    classifyResults();
  }, [scannedData, brandSelections]);

  const formatMacAddress = (mac) => {
    if (!mac) return 'non'; // กรณีที่ mac เป็น null หรือ undefined
    return mac.match(/.{1,2}/g).join(':');
  };

  const handleBrandChange = (fileName, brand) => {
    setBrandSelections(prev => ({
      ...prev,
      [fileName]: brand
    }));
  };


  const handleSelectAll = (brand) => {
    const newBrandSelections = results.reduce((acc, result) => {
      acc[result.fileName] = brand;
      return acc;
    }, {});
    setBrandSelections(newBrandSelections);
  };
  const handleDropdownChange = (e) => {
    const value = e.target.value;
    if (value === 'select-all-reyee') {
      handleSelectAll('reyee');
    } else if (value === 'select-all-unifi') {
      handleSelectAll('UniFi');
    } else if (value === 'select-all-tp-link') {
      handleSelectAll('tp-link');
    } else if (value === 'select-all-cisco') {
      handleSelectAll('cisco');
    } else {
      setSelectedBrand(value);
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(results.map(result => ({
      'File Name': result.fileName,
      'Scanned Data': result.scannedData,
      'Brand': brandSelections[result.fileName] || '',
      'S/N': result.sn,
      'MAC': result.mac,
      'Model': result.model
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Scanned Results");
    XLSX.writeFile(wb, "scanned_results.xlsx");
  };

  return (
    <Container maxWidth="full">
      <Box mt={4} textAlign="center">
        <input
          style={{ display: 'none' }}
          id="raised-button-file"
          multiple
          type="file"
          onChange={captureImage}
          accept=".jpg,.jpeg,.icon,.gif,.svg,.webp,.png,.bmp"
        />
        <label htmlFor="raised-button-file">
          <Button variant="contained" color="primary" component="span">
            Upload Images
          </Button>
        </label>
      </Box>
      <Box mt={4}>
        <Typography variant="h6" component="div" gutterBottom>
          Scanned Results
        </Typography>
        <FormControl fullWidth>
          <InputLabel>Brand</InputLabel>
          <Select
            value={selectedBrand}
            onChange={handleDropdownChange}
          >
            <MenuItem value="">Select Brand</MenuItem>
            <MenuItem value="select-all-reyee">Select All as Reyee</MenuItem>
            <MenuItem value="select-all-unifi">Select All as UniFi</MenuItem>
            <MenuItem value="select-all-tp-link">Select All as TP-Link</MenuItem>
            <MenuItem value="select-all-cisco">Select All as Cisco</MenuItem>
          </Select>
        </FormControl>
        <TableContainer component={Paper} sx={{ marginTop: 2 }}>
          <Table>
            <TableHead>
              <StyledTableRow>
                <StyledTableCell>File Name</StyledTableCell>
                <StyledTableCell>Scanned Data</StyledTableCell>
                <StyledTableCell>Brand</StyledTableCell>
                <StyledTableCell>S/N</StyledTableCell>
                <StyledTableCell>MAC</StyledTableCell>
                <StyledTableCell>Model</StyledTableCell>
              </StyledTableRow>
            </TableHead>
            <TableBody>
              {results.map((result, index) => (
                <StyledTableRow key={index}>
                  <TableCell>{result.fileName}</TableCell>
                  <TableCell>{result.scannedData}</TableCell>
                  <TableCell>
                    <FormControl fullWidth>
                      <InputLabel>Brand</InputLabel>
                      <Select
                        value={brandSelections[result.fileName] || ''}
                        onChange={(e) => handleBrandChange(result.fileName, e.target.value)}
                      >
                        <MenuItem value="reyee">Reyee</MenuItem>
                        <MenuItem value="UniFi">UniFi</MenuItem>
                        <MenuItem value="tp-link">TP-Link</MenuItem>
                        <MenuItem value="cisco">Cisco</MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell>{result.sn}</TableCell>
                  <TableCell>{result.mac}</TableCell>
                  <TableCell>{result.model}</TableCell>
                </StyledTableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Box mt={2}>
          <Button variant="contained" color="primary" onClick={exportToExcel}>
            Export to Excel
          </Button>
        </Box>
      </Box>
    </Container>
  );
};
