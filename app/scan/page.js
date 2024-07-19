"use client";
import { useEffect, useState, useRef } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { useDropzone } from 'react-dropzone';
import { Box, Button, Typography, Table, TableContainer, TableHead, TableBody, TableRow, TableCell } from '@mui/material';

export default function ScanPage() {
  const [codeResults, setCodeResults] = useState([]);
  const [imageSrcs, setImageSrcs] = useState([]);
  const [fileNames, setFileNames] = useState([]);
  const reader = useRef(new BrowserQRCodeReader());
  const imageElements = useRef([]);

  const onDrop = (acceptedFiles) => {
    const files = acceptedFiles;
    const fileReaders = files.map((file) => {
      const fileReader = new FileReader();
      fileReader.onload = (event) => {
        preprocessImage(event.target.result, file.name);
      };
      fileReader.readAsDataURL(file);
      return fileReader;
    });
  };

  const preprocessImage = (src, name) => {
    setImageSrcs((prevImageSrcs) => [...prevImageSrcs, src]);
    setFileNames((prevFileNames) => [...prevFileNames, name]);
    setCodeResults((prevCodeResults) => [...prevCodeResults, '']); // Initialize result as empty string
  };

  useEffect(() => {
    const decodeBarcodes = async () => {
      const results = await Promise.all(imageElements.current.map(async (element, index) => {
        try {
          const result = await reader.current.decodeFromImageElement(element);
          return result.getText();
        } catch (error) {
          console.error('Error decoding barcode:', error);
          return 'ไม่เจอรหัส'; // Set result as "ไม่เจอรหัส" if decoding fails
        }
      }));

      setCodeResults(results);
    };

    if (imageElements.current.length > 0) {
      decodeBarcodes();
    }
  }, [imageElements.current, imageSrcs]);

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      bgcolor="#f5f5f5"
      padding="20px"
    >
      <Typography variant="h4" gutterBottom>
        QR Code Scanner
      </Typography>
      <Box
        {...getRootProps({ className: 'dropzone' })}
        border="2px dashed #cccccc"
        borderRadius="8px"
        padding="20px"
        textAlign="center"
        bgcolor="#ffffff"
        marginBottom="20px"
      >
        <input {...getInputProps()} />
        <Typography variant="body1">
          ลากและวางภาพที่นี่เพื่อสแกน QR code หรือคลิกเพื่อเลือกภาพ
        </Typography>
        <Button variant="contained" color="primary" style={{ marginTop: '10px' }}>
          เลือกภาพ
        </Button>
      </Box>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ภาพ</TableCell>
              <TableCell>ผลลัพธ์</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {imageSrcs.map((src, index) => (
              <TableRow key={index}>
                <TableCell>
                  <img
                    src={src}
                    alt={`Uploaded ${index}`}
                    style={{ maxWidth: '100%', maxHeight: '400px' }}
                    ref={(el) => (imageElements.current[index] = el)}
                  />
                </TableCell>
                <TableCell>
                  {codeResults[index] !== null && (
                    <Typography variant="body1">
                      {codeResults[index]}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ชื่อ</TableCell>
              <TableCell>QR Code</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fileNames.map((name, index) => (
              <TableRow key={index}>
                <TableCell>
                  {name}
                </TableCell>
                <TableCell>
                  {codeResults[index] !== null && (
                    <Typography variant="body1">
                      {codeResults[index]}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
