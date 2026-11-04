import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
const root = process.cwd();
const file = process.env.LOCAL_STORE_PATH
  ? path.resolve(root, process.env.LOCAL_STORE_PATH)
  : path.join(root, "data", "store.json");
const schema = z.object({
  imports: z.array(z.object({
    id: z.string().max(100),
    fileName: z.string().max(255),
    reportType: z.enum(["orders", "payments", "returns", "products", "feedback"]),
    importedAt: z.string().max(50),
    rows: z.array(z.record(z.string(), z.unknown())).max(100000),
    warnings: z.array(z.union([
      z.string().max(500),
      z.object({ key: z.string().max(100), count: z.number().int().nonnegative().optional() }),
    ])).max(100),
    isDemo: z.boolean().optional(),
    sourceHeaders: z.array(z.string().max(256)).max(1000).optional(),
  })).max(250),
  language: z.enum(["en", "ru", "uz"]).default("en"),
});

async function loadStore() {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { imports: [], language: "en" };
    throw error;
  }
}

export async function GET() {
  try {
    return NextResponse.json(await loadStore());
  } catch (error) {
    console.error("Failed to load local marketplace data.", error);
    return NextResponse.json({ error: "Could not read the local data store." }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "The submitted data did not pass validation.", details: parsed.error.issues }, { status: 400 });
    await mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.tmp`;
    await writeFile(temporary, JSON.stringify(parsed.data), "utf8");
    const { rename } = await import("node:fs/promises");
    await rename(temporary, file);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to save local marketplace data.", error);
    return NextResponse.json({ error: "Could not save local data." }, { status: 500 });
  }
}
