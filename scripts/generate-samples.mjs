import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDemoSources } from "../src/lib/demo.js";
import { makeCsv } from "../src/lib/data.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "public", "samples");
await mkdir(output, { recursive: true });

for (const { fileName, rawRows } of createDemoSources()) {
  await writeFile(path.join(output, fileName), makeCsv(rawRows), "utf8");
  console.log(`Generated ${fileName} (${rawRows.length} rows)`);
}
