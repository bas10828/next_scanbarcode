"use client";
import { useEffect, useRef, useState } from 'react';
import { BarcodeReader } from 'dynamsoft-javascript-barcode';
import { useDropzone } from 'react-dropzone';
import styles from './page.module.css'; // ใช้ CSS module สำหรับจัดรูปแบบ

const BarcodeScanner = ({ onScan }) => {
  const videoRef = useRef(null);
  const [scanResults, setScanResults] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [readerInitialized, setReaderInitialized] = useState(false);
  const [scanning, setScanning] = useState(false);

  const initializeBarcodeReader = async () => {
    try {
      BarcodeReader.licenseKey = 'DLS2eyJoYW5kc2hha2VDb2RlIjoiMTAzMDE2MjExLVRYbFhaV0pRY205cSIsIm1haW5TZXJ2ZXJVUkwiOiJodHRwczovL21kbHMuZHluYW1zb2Z0b25saW5lLmNvbSIsIm9yZ2FuaXphdGlvbklEIjoiMTAzMDE2MjExIiwic3RhbmRieVNlcnZlclVSTCI6Imh0dHBzOi8vc2Rscy5keW5hbXNvZnRvbmxpbmUuY29tIiwiY2hlY2tDb2RlIjotNDIzMTAwMTE2fQ==';
      BarcodeReader.engineResourcePath = 'https://cdn.jsdelivr.net/npm/dynamsoft-javascript-barcode/dist/';

      const reader = await BarcodeReader.createInstance();
      await reader.setVideoElement(videoRef.current);
      await reader.open();

      reader.onFrameRead = results => {
        for (const result of results) {
          console.log(result.barcodeText);
        }
      };

      reader.onUnduplicatedRead = (txt, result) => {
        onScan(txt);
        setScanResults(prev => [...prev, { fileName: 'Live Scan', result: txt }]);
        setScanning(false);
      };

      setReaderInitialized(true);
      setScanning(true);
    } catch (error) {
      console.error(error);
    }
  };

  const handleUserInteraction = () => {
    if (!readerInitialized) {
      initializeBarcodeReader();
    }
  };

  useEffect(() => {
    window.addEventListener('click', handleUserInteraction);
    return () => {
      window.removeEventListener('click', handleUserInteraction);
    };
  }, [readerInitialized]);

  const handleDrop = async (acceptedFiles) => {
    setUploadedFiles(acceptedFiles);
    const reader = await BarcodeReader.createInstance();
    setScanning(true); // Start scanning files
    for (const file of acceptedFiles) {
      const fileReader = new FileReader();
      fileReader.onload = async (e) => {
        const image = new Image();
        image.src = e.target.result;
        image.onload = async () => {
          try {
            const results = await reader.decode(image);
            results.forEach(result => {
              setScanResults(prev => [...prev, { fileName: file.name, result: result.barcodeText }]);
            });
          } catch (err) {
            console.error(`Error decoding ${file.name}: `, err);
            setScanResults(prev => [...prev, { fileName: file.name, result: 'Error decoding barcode' }]);
          } finally {
            setScanning(false); // Stop scanning files
          }
        };
      };
      fileReader.readAsDataURL(file);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop: handleDrop });
  console.log("result : ", scanResults);

  return (
    <div className={styles.container}>
      <div className={styles.videoContainer}>
        <video ref={videoRef} width="300" height="200" />
      </div>
      <div {...getRootProps({ className: styles.dropzone })}>
        <input {...getInputProps()} />
        <p>ลากและวางไฟล์ที่นี่ หรือคลิกเพื่อเลือกไฟล์</p>
      </div>
      {scanning && <p>กำลังสแกน...</p>}
      {scanResults.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ชื่อไฟล์</th>
              <th>ผลลัพธ์</th>
            </tr>
          </thead>
          <tbody>
            {scanResults.sort((a, b) => a.fileName.localeCompare(b.fileName)).map((item, index) => (
              <tr key={index}>
                <td>{item.fileName}</td>
                <td>{item.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default BarcodeScanner;
