import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

export const exportReportToWord = async (report: string): Promise<void> => {
  const reportSections = report.split("\n").filter((line) => line.trim() !== "");

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: reportSections.map(
          (section) =>
            new Paragraph({
              children: [
                new TextRun({ text: section, font: "TH SarabunPSK", size: 32 }),
              ],
              spacing: { before: 200, after: 200 },
            }),
        ),
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `รายงานโครงการ_${new Date().toISOString().slice(0, 10)}.docx`);
};
