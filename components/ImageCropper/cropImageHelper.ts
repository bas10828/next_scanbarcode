// components/ImageCropper/cropImageHelper.ts

/**
 * ฟังก์ชันสร้าง HTMLImageElement จาก URL
 */
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (error) => reject(error));
    img.src = url;
  });

/**
 * ฟังก์ชันครอปรูปพร้อมหมุน
 * @param imageSrc URL ของรูป
 * @param crop {x, y, width, height} ขนาดครอป
 * @param rotation หมุนเป็นองศา
 * @returns Promise<string> URL ของ blob image ใหม่
 */
export const getCroppedImg = async (
  imageSrc: string,
  crop: { x: number; y: number; width: number; height: number },
  rotation: number = 0
): Promise<string> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const radians = (rotation * Math.PI) / 180;

  canvas.width = crop.width;
  canvas.height = crop.height;

  // วางกลาง canvas และหมุน
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(radians);

  // วางรูปโดย offset จาก crop
  ctx.drawImage(
    image,
    image.width / -2 - crop.x,
    image.height / -2 - crop.y
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const fileUrl = URL.createObjectURL(blob);
      resolve(fileUrl);
    }, "image/jpeg");
  });
};
