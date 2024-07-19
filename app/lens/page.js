"use client";
import React, { useState } from 'react';
import Tesseract from 'tesseract.js';

const ScanBarcodeComponent = () => {
  const [ocrResults, setOcrResults] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [dataRows, setDataRows] = useState([]);

  const processImageForOCR = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          const maxWidth = 800;
          let newWidth = img.width;
          let newHeight = img.height;
          if (img.width > maxWidth) {
            const ratio = maxWidth / img.width;
            newWidth = maxWidth;
            newHeight = img.height * ratio;
          }

          canvas.width = newWidth;
          canvas.height = newHeight;
          ctx.drawImage(img, 0, 0, newWidth, newHeight);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] += 20;
            imageData.data[i + 1] += 20;
            imageData.data[i + 2] += 20;
          }
          ctx.putImageData(imageData, 0, 0);

          for (let i = 0; i < imageData.data.length; i += 4) {
            const avg = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
            imageData.data[i] = avg;
            imageData.data[i + 1] = avg;
            imageData.data[i + 2] = avg;
          }
          ctx.putImageData(imageData, 0, 0);

          const processedImageDataUrl = canvas.toDataURL('image/jpeg');
          resolve(processedImageDataUrl);
        };
        img.onerror = (err) => reject(err);
        img.src = e.target.result;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const readImageOCR = async (event) => {
    const files = event.target.files;
    const processedImageDataUrls = [];
    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const processedImageDataUrl = await processImageForOCR(file);
      processedImageDataUrls.push(processedImageDataUrl);

      const { data: { text } } = await Tesseract.recognize(processedImageDataUrl, 'eng');
      results.push({ text, fileName: file.name });
    }

    setImagePreviews(processedImageDataUrls);
    setOcrResults(results);

    const rows = [];
    results.forEach(result => {
      const parsedRows = parseOcrResult(result.text, result.fileName);
      rows.push(...parsedRows);
    });

    setDataRows(rows);
  };

  const parseOcrResult = (text, fileName) => {
    const lines = text.split('\n');
    const parsedRows = [];

    let currentRow = {
      name: fileName,
      S_N: '',
      MAC: ''
    };

    lines.forEach(line => {
      const snMatch = line.match(/(?:S\/N:|SERIAL NO:|s\/n:|SIN:|SERALNO)\s*(.*)/i);
      const macMatch = line.match(/MAC:\s*(.*)/i);

      if (snMatch) {
        currentRow.S_N = snMatch[1].trim();
      }

      if (macMatch) {
        currentRow.MAC = macMatch[1].trim();
      }

      if (currentRow.S_N !== '' && currentRow.MAC !== '') {
        parsedRows.push({ ...currentRow });
        currentRow = {
          name: fileName,
          S_N: '',
          MAC: ''
        };
      }
    });

    return parsedRows;
  };

  return (
    <div>
      <h2>Read Images for OCR</h2>
      <input type="file" accept="image/*" multiple onChange={readImageOCR} />

      {imagePreviews.length > 0 && (
        <div>
          <h2>Image Previews</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {imagePreviews.map((preview, index) => (
              <div key={index} style={{ margin: '10px', maxWidth: '200px' }}>
                <img src={preview} alt={`Selected ${index}`} style={{ maxWidth: '100%' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      <h2>Filtered Results</h2>
      <table>
        <thead>
          <tr>
            <th>File Name</th>
            <th>S/N</th>
            <th>MAC</th>
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, index) => (
            <tr key={index}>
              <td>{row.name}</td>
              <td>{row.S_N}</td>
              <td>{row.MAC}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ScanBarcodeComponent;
