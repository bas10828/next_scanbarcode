// src/components/ImageConvert.tsx
import React, { useState } from 'react';
import heic2any from 'heic2any';
import { Container, Typography, Button, CircularProgress, Box, Grid, IconButton } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ImageList from '@mui/material/ImageList';
import ImageListItem from '@mui/material/ImageListItem';

const ImageConvert: React.FC = () => {
  const [convertedImages, setConvertedImages] = useState<{ name: string; url: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setLoading(true);
      const fileArray = Array.from(files);
      const convertedImagePromises = fileArray.map(async (file) => {
        if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
          try {
            const blob = await heic2any({
              blob: file,
              toType: 'image/jpeg',
              quality: 0.8,
            });
            const url = URL.createObjectURL(blob as Blob);
            return { name: file.name, url };
          } catch (error) {
            console.error(`Conversion failed for ${file.name}:`, error);
            return null;
          }
        } else {
          alert(`${file.name} is not a .heic file`);
          return null;
        }
      });

      const imageResults = await Promise.all(convertedImagePromises);
      setConvertedImages(imageResults.filter(result => result !== null) as { name: string; url: string }[]);
      setLoading(false);
    } else {
      alert('No files selected');
    }
  };

  const handleDownload = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    convertedImages.forEach((image, index) => {
      handleDownload(image.url, `converted-${index + 1}.jpg`);
    });
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4, p: 2, backgroundColor: 'white', borderRadius: 2, boxShadow: 1 }}>
      <Typography variant="h4" align="center" gutterBottom>
        Convert HEIC to JPEG
      </Typography>
      <input
        type="file"
        accept=".heic"
        multiple
        onChange={handleFileChange}
        style={{ display: 'block', margin: '0 auto', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', background: '#fafafa' }}
      />
      {loading && <CircularProgress sx={{ display: 'block', margin: '20px auto' }} />}
      {convertedImages.length > 0 && (
        <Box>
          <Button
            variant="contained"
            color="primary"
            onClick={handleDownloadAll}
            startIcon={<DownloadIcon />}
            sx={{ mb: 2 }}
          >
            Download All
          </Button>
          <ImageList cols={3} gap={16}>
            {convertedImages.map((image, index) => (
              <ImageListItem key={index}>
                <img src={image.url} alt={`Converted ${index + 1}`} loading="lazy" />
                <Box sx={{ textAlign: 'center', mt: 1 }}>
                  <IconButton
                    color="primary"
                    onClick={() => handleDownload(image.url, `converted-${index + 1}.jpg`)}
                    aria-label={`Download Image ${index + 1}`}
                  >
                    <DownloadIcon />
                  </IconButton>
                </Box>
              </ImageListItem>
            ))}
          </ImageList>
        </Box>
      )}
    </Container>
  );
};

export default ImageConvert;
