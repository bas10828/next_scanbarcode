// Apply rotation + crop in a single canvas operation.
//
// react-easy-crop v4+ returns croppedAreaPixels in the coordinate space of the
// rotated image's bounding box — so we size the canvas to that bounding box,
// draw the rotated image into it, then read out the crop with getImageData directly.

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (err) => reject(err));
    img.src = url;
  });

export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const cropAndRotate = async (
  imageSrc: string,
  pixelCrop: PixelCrop,
  rotation = 0,
  mimeType: "image/jpeg" | "image/png" = "image/jpeg",
  quality = 0.95,
): Promise<Blob | null> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const rotRad = (rotation * Math.PI) / 180;

  // Bounding box of the rotated image.
  const bBoxWidth =
    Math.abs(Math.cos(rotRad) * image.width) +
    Math.abs(Math.sin(rotRad) * image.height);
  const bBoxHeight =
    Math.abs(Math.sin(rotRad) * image.width) +
    Math.abs(Math.cos(rotRad) * image.height);

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // Rotate the image around the bounding-box center.
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  // croppedAreaPixels is in bounding-box coordinate space — read directly.
  const data = ctx.getImageData(
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
  );

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.putImageData(data, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
};
