// Build a sanitized test fixture from a real estimate + inventory xlsx.
// Usage: node scripts/make-fixture.mjs <estimate.xlsx> <inventory.xlsx> <out.json>
// Serial numbers, MAC and IP addresses are replaced with fake values because
// this repo is public; models, device names and locations are kept so the
// report text exercises the real matching rules.
import readXlsxFile from "read-excel-file/node";
import { writeFileSync } from "node:fs";

const [estimatePath, inventoryPath, outPath] = process.argv.slice(2);
if (!outPath) {
  console.error("usage: node scripts/make-fixture.mjs <estimate.xlsx> <inventory.xlsx> <out.json>");
  process.exit(1);
}

const clean = (rows) => rows.map((r) => r.map((c) => (c === false ? null : c instanceof Date ? c.toISOString() : c)));

const project = clean(await readXlsxFile(estimatePath));
const inventory = clean(await readXlsxFile(inventoryPath));

const hex = (n) => n.toString(16).toUpperCase().padStart(2, "0");
let n = 0;
for (const row of inventory) {
  if (typeof row[0] !== "number") continue;
  n++;
  if (row[4]) row[4] = `SN${String(n).padStart(6, "0")}`;
  if (row[5]) row[5] = `02:00:00:00:${hex(n >> 8)}:${hex(n & 255)}`;
  if (row[7]) row[7] = `10.0.${n >> 8}.${n & 255}`;
}

writeFileSync(outPath, JSON.stringify({ project, inventory }, null, 1));
console.log(`${outPath}: ${project.length} project rows, ${inventory.length} inventory rows, ${n} devices sanitized`);
