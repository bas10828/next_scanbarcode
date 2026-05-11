import { Document, Packer, Paragraph, TextRun, ImageRun } from "docx";
import { saveAs } from "file-saver";
import type { ReportImage } from "./types";

// 5 cm per image: 197px × 9144 EMU = 1 801 368 EMU ÷ 360 000 ≈ 5 cm
const CM5 = 197;

function b64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function scaleTo5cm(w: number, h: number) {
  const r = Math.min(CM5 / w, CM5 / h);
  return { width: Math.round(w * r), height: Math.round(h * r) };
}

function getImageType(name: string): "jpg" | "png" | "gif" | "bmp" {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "png") return "png";
  if (ext === "gif") return "gif";
  if (ext === "bmp") return "bmp";
  return "jpg";
}

function makeImageRow(images: ReportImage[]): Paragraph {
  const runs: (ImageRun | TextRun)[] = [];
  images.forEach((img, i) => {
    if (i > 0) runs.push(new TextRun({ text: "  " }));
    const dims = scaleTo5cm(img.w, img.h);
    runs.push(
      new ImageRun({
        data: b64ToUint8Array(img.b64),
        transformation: dims,
        type: getImageType(img.name),
      }),
    );
  });
  return new Paragraph({ children: runs, spacing: { before: 100, after: 200 } });
}

export const exportReportToWord = async (
  report: string,
  lineImages: Record<number, ReportImage[]> = {},
): Promise<void> => {
  const lines = report.split("\n");
  const children: Paragraph[] = [];

  lines.forEach((line, idx) => {
    if (line.trim() === "") {
      children.push(new Paragraph({ text: "" }));
      return;
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
        children.push(makeImageRow(matched.slice(i, i + 3)));
      }
    }
  });

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
