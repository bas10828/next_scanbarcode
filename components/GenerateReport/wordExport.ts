import { Document, Packer, Paragraph, TextRun, ImageRun } from "docx";
import { saveAs } from "file-saver";
import type { ReportImage } from "./types";

// 5 cm per image: 197px × 9144 EMU = 1 801 368 EMU ÷ 360 000 ≈ 5 cm
const CM5 = 197;

function scaleTo5cm(w: number, h: number) {
  const r = Math.min(CM5 / w, CM5 / h);
  return { width: Math.round(w * r), height: Math.round(h * r) };
}

// Resize image to 2× display size via canvas before embedding — keeps quality while dropping file size
async function resizeImage(img: ReportImage, displayW: number, displayH: number): Promise<Uint8Array> {
  const targetW = displayW * 2;
  const targetH = displayH * 2;

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d")!;

  const el = new Image();
  await new Promise<void>((resolve, reject) => {
    el.onload = () => resolve();
    el.onerror = reject;
    el.src = img.dataUrl;
  });

  ctx.drawImage(el, 0, 0, targetW, targetH);

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

async function makeImageRow(images: ReportImage[]): Promise<Paragraph> {
  const runs: (ImageRun | TextRun)[] = [];
  for (let i = 0; i < images.length; i++) {
    if (i > 0) runs.push(new TextRun({ text: "  " }));
    const img = images[i];
    const dims = scaleTo5cm(img.w, img.h);
    const data = await resizeImage(img, dims.width, dims.height);
    runs.push(
      new ImageRun({
        data,
        transformation: dims,
        type: "jpg",
      }),
    );
  }
  return new Paragraph({ children: runs, spacing: { before: 100, after: 200 } });
}

export const exportReportToWord = async (
  report: string,
  lineImages: Record<number, ReportImage[]> = {},
): Promise<void> => {
  const lines = report.split("\n");
  const children: Paragraph[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (line.trim() === "") {
      children.push(new Paragraph({ text: "" }));
      continue;
    }

    children.push(
      new Paragraph({
        children: [new TextRun({ text: line, font: "TH SarabunPSK", size: 32 })],
        spacing: { before: 200, after: 200 },
      }),
    );

    const matched = lineImages[idx];
    if (matched && matched.length > 0) {
      for (let i = 0; i < matched.length; i += 3) {
        children.push(await makeImageRow(matched.slice(i, i + 3)));
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1134,    // 2 cm
              right: 1417,  // 2.5 cm — content width = 21 - 5 = 16 cm → 3×5 cm + spaces fits
              bottom: 1134,
              left: 1417,
            },
          },
        },
        children,
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `รายงานโครงการ_${new Date().toISOString().slice(0, 10)}.docx`);
};
