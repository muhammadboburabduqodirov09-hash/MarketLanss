import test from "node:test";
import assert from "node:assert/strict";
  import { readFile } from "node:fs/promises";
  import * as XLSX from "@e965/xlsx";
  import {
    analyzeColumnTypes,
    calculateInventoryInsights,
    calculatePaymentAudit,
  calculateReturns,
  categorizeReturn,
  escapeCsv,
  inspectRows,
  mapRows,
  normalizeDate,
  normalizeNumber,
  parseUpload,
  recognizeColumns,
} from "../src/lib/data.js";
import { createDemoImports } from "../src/lib/demo.js";

test("parses CSV with comma, semicolon, and tab delimiters", async () => {
  for (const [delimiter, name] of [[",", "comma.csv"], [";", "semicolon.csv"], ["\t", "tab.csv"]]) {
    const text = `order_id${delimiter}amount\nA-1${delimiter}12.50`;
    const parsed = await parseUpload({ name, size: text.length, text: async () => text });
    assert.deepEqual(parsed.rows, [{ order_id: "A-1", amount: "12.50" }]);
  }
});

test("parses the first worksheet in an Excel workbook", async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["order_id", "amount"], ["A-2", 28.5]]), "Orders");
  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const parsed = await parseUpload({
    name: "orders.xlsx",
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].order_id, "A-2");
});

test("rejects unsupported extensions and oversize files", async () => {
  await assert.rejects(() => parseUpload({ name: "orders.json", size: 2 }), /Choose a CSV/);
  await assert.rejects(() => parseUpload({ name: "orders.csv", size: 10 * 1024 * 1024 + 1 }), /10 MB/);
});

test("recognizes normalized headers and requires confirmation for ambiguous amounts", () => {
  const result = recognizeColumns(["Product Name", "seller-sku", "order_id", "amount", "payment_amount"]);
  assert.deepEqual(result.map((column) => column.field), ["product", "sku", "orderId", "", "amount"]);
  assert.equal(result[3].confidence, "low");
  assert.equal(recognizeColumns(["feedback"])[0].field, "comment");
});

test("maps optional return, customer, marketplace, and inventory fields without losing feedback text", () => {
  const headers = [
    "return_id", "order_id", "product_name", "sku", "quantity", "return_reason",
    "customer_feedback", "return_status", "customer_name", "customer_id", "phone",
    "email", "telegram_username", "marketplace_name", "conversation_url", "marketplace_account_url",
    "refund_amount", "available_stock",
  ];
  const mappings = Object.fromEntries(recognizeColumns(headers).map(({ header, field }) => [header, field]));
  const fullText = "  The product failed on the first day.\nPlease contact me after 5 PM.  ";
  const raw = {
    return_id: "RET-7", order_id: "ORD-7", product_name: "Desk lamp", sku: "LAMP-1",
    quantity: "2", return_reason: "Damaged product", customer_feedback: fullText,
    return_status: "Approved", customer_name: "Buyer", customer_id: "C-7",
    phone: "+1 555 0100", email: "buyer@example.test", telegram_username: "buyer7",
    marketplace_name: "Example Market", conversation_url: "https://market.example/orders/ORD-7",
    marketplace_account_url: "https://market.example/account/C-7",
    refund_amount: "24.50", available_stock: "8",
  };
  const row = mapRows([raw], mappings)[0];
  assert.equal(row.customerFeedback, fullText);
  assert.equal(row.returnId, "RET-7");
  assert.equal(row.status, "Approved");
  assert.equal(row.marketplaceConversationUrl, raw.conversation_url);
  assert.equal(row.marketplaceAccountUrl, raw.marketplace_account_url);
  assert.equal(row.refund, -24.5);
  assert.equal(row.stockQuantity, 8);
  assert.deepEqual(inspectRows([raw], [row], "returns").invalidIndexes, []);

  const reasonOnly = mapRows([{ order_id: "ORD-8", return_reason: "Wrong size" }], {
    order_id: "orderId", return_reason: "returnReason",
  });
  assert.deepEqual(inspectRows([{ order_id: "ORD-8", return_reason: "Wrong size" }], reasonOnly, "returns").invalidIndexes, []);
  const missingReason = mapRows([{ order_id: "ORD-9" }], { order_id: "orderId" });
  assert.deepEqual(inspectRows([{ order_id: "ORD-9" }], missingReason, "returns").invalidIndexes, [0]);
});

test("imports the sample return report with fictional customer details and no marketplace links", async () => {
  const text = await readFile(new URL("../public/samples/returns_sample.csv", import.meta.url), "utf8");
  const parsed = await parseUpload({ name: "returns_sample.csv", size: Buffer.byteLength(text), text: async () => text });
  const mappings = Object.fromEntries(recognizeColumns(parsed.headers).map(({ header, field }) => [header, field]));
  const mapped = mapRows(parsed.rows, mappings);
  assert.equal(mapped.length, parsed.rows.length);
  assert.ok(mapped.every((row) => row.orderId && row.returnReason));
  assert.ok(mapped.every((row) => row.customerName.startsWith("Sample Buyer ")));
  assert.ok(mapped.every((row) => row.customerPhone.startsWith("202-555-01")));
  assert.ok(mapped.every((row) => row.customerEmail.endsWith("@example.com")));
  assert.ok(mapped.every((row) => row.customerTelegram.startsWith("sample.buyer")));
  assert.ok(mapped.every((row) => !row.marketplaceConversationUrl && !row.marketplaceAccountUrl));
  assert.deepEqual(inspectRows(parsed.rows, mapped, "returns").invalidIndexes, []);
});

test("parses every published sample CSV", async () => {
  for (const name of ["orders_sample.csv", "payments_sample.csv", "products_sample.csv", "feedback_sample.csv", "returns_sample.csv"]) {
    const text = await readFile(new URL(`../public/samples/${name}`, import.meta.url), "utf8");
    const parsed = await parseUpload({ name, size: Buffer.byteLength(text), text: async () => text });
    assert.ok(parsed.headers.length > 0, `${name} has headers`);
    assert.ok(parsed.rows.length > 0, `${name} has data rows`);
  }
});

test("maps values, normalizes locale numbers and dates, and retains ignored fields", () => {
  const rows = mapRows([{ "order_id": "A-1", "unit-price": "1.234,50", "order_date": "04/03/2026", "extra_note": "keep" }], {
    order_id: "orderId", "unit-price": "unitPrice", order_date: "date", extra_note: "",
  });
  assert.equal(rows[0].unitPrice, 1234.5);
  assert.equal(rows[0].date, "2026-04-03");
  assert.deepEqual(rows[0].additional, { extra_note: "keep" });
  assert.equal(normalizeNumber("(2,50)"), -2.5);
  assert.equal(normalizeNumber("ORDER-X"), null);
  assert.equal(normalizeDate("2026-03-04"), "2026-03-04");
});

test("detects duplicates, missing required values, empty columns, and data types", () => {
  const raw = [{ order_id: "A", blank: "", amount: "1.50" }, { order_id: "A", blank: "", amount: "1.50" }, { order_id: "", blank: "", amount: "2.00" }];
  const mapped = mapRows(raw, { order_id: "orderId", blank: "", amount: "amount" });
  const report = inspectRows(raw, mapped, "orders");
  assert.deepEqual(report.duplicateIndexes, [1]);
  assert.deepEqual(report.invalidIndexes, [2]);
  assert.deepEqual(report.emptyColumns, ["blank"]);
  assert.deepEqual(analyzeColumnTypes(raw), { order_id: "text", blank: "empty", amount: "number" });
  const missingMoney = mapRows([{ order_id: "A" }], { order_id: "orderId" });
  assert.deepEqual(inspectRows([{ order_id: "A" }], missingMoney, "orders").invalidIndexes, [0]);
});

test("matches signed fee and refund rows and flags duplicates and unmatched transactions", () => {
  const orders = [
    { orderId: "A", amount: 100, date: "2026-01-01" },
    { orderId: "B", amount: 25, date: "2026-01-01" },
    { orderId: "C", amount: 40, date: "2026-01-01" },
  ];
  const payments = [
    { orderId: "A", amount: 100, transactionType: "payment", date: "2026-01-02" },
    { orderId: "A", amount: -3, transactionType: "fee", date: "2026-01-02" },
    { orderId: "A", amount: -20, transactionType: "refund", date: "2026-01-02" },
    { orderId: "C", amount: 40, transactionType: "payment", date: "2026-01-02" },
    { orderId: "C", amount: 40, transactionType: "payment", date: "2026-01-02" },
    { orderId: "OUTSIDE", amount: 7, transactionType: "payment" },
  ];
  const result = calculatePaymentAudit([
    { reportType: "orders", rows: orders },
    { reportType: "payments", rows: payments },
  ]);
  assert.equal(result.rows.find((row) => row.orderId === "A").expected, 77);
  assert.equal(result.rows.find((row) => row.orderId === "A").status, "matched");
  assert.equal(result.rows.find((row) => row.orderId === "B").status, "unmatched");
  assert.equal(result.rows.find((row) => row.orderId === "C").status, "possible_duplicate");
  assert.equal(result.rows.at(-1).orderId, "OUTSIDE");
  assert.equal(result.hasUsableOrders, true);
  assert.equal(result.hasUsablePayments, true);
});

test("classifies return reasons deterministically and aggregates imported records", () => {
  assert.equal(categorizeReturn("The fit is too small"), "Incorrect size");
  assert.equal(categorizeReturn("Arrived broken"), "Damaged product");
  assert.equal(categorizeReturn(""), "Unknown");
  const result = calculateReturns([
    { id: "r", reportType: "returns", rows: [
      { orderId: "A", product: "Bottle", returnReason: "small size", date: "2026-01-10" },
      { orderId: "B", product: "Bottle", returnReason: "broken", date: "2026-02-10" },
    ] },
    { reportType: "orders", rows: [{ orderId: "A" }, { orderId: "B" }, { orderId: "C" }] },
  ]);
  assert.equal(result.totalReturns, 2);
  assert.equal(result.returnRate, 2 / 3);
  assert.equal(result.productCounts[0].name, "Bottle");
  assert.equal(result.trendCounts.length, 2);
});

test("produces inventory recommendations only from imported stock and dated sales", () => {
  const insights = calculateInventoryInsights([
    { reportType: "products", rows: [{ product: "Desk lamp", sku: "L-1", stockQuantity: 4 }] },
    { reportType: "orders", rows: [
      { product: "Desk lamp", sku: "L-1", quantity: 3, date: "2026-01-03" },
      { product: "Desk lamp", sku: "L-1", quantity: 6, date: "2026-02-03" },
      { product: "Mug", sku: "M-1", quantity: 2, date: "2026-01-05" },
      { product: "Mug", sku: "M-1", quantity: 4, date: "2026-02-05" },
    ] },
  ]);
  const lamp = insights.find((item) => item.sku === "L-1");
  const mug = insights.find((item) => item.sku === "M-1");
  assert.match(lamp.recommendation, /consider restocking/i);
  assert.equal(lamp.tone, "warning");
  assert.equal(lamp.averageMonthlyDemand, 4.5);
  assert.deepEqual(lamp.monthlySalesHistory, [
    { month: "2026-01", units: 3 },
    { month: "2026-02", units: 6 },
  ]);
  assert.match(mug.recommendation, /increased 100%/i);
  assert.equal(mug.stock, null);
});

test("demo records are linked consistently and include intentional audit cases", () => {
  const imports = createDemoImports();
  const orders = imports.find((item) => item.reportType === "orders").rows;
  const payments = imports.find((item) => item.reportType === "payments").rows;
  const returns = imports.find((item) => item.reportType === "returns").rows;
  assert.equal(orders.length, 120);
  assert.ok(payments.length > orders.length);
  assert.ok(returns.length > 0);
  const ids = new Set(orders.map((row) => row.orderId));
  assert.ok(payments.every((row) => ids.has(row.orderId)));
  assert.ok(returns.every((row) => ids.has(row.orderId)));
  const audit = calculatePaymentAudit(imports);
  assert.ok(audit.rows.some((row) => row.status === "possible_duplicate"));
  assert.ok(audit.rows.some((row) => row.status === "partially_matched"));
  assert.ok(audit.rows.some((row) => row.status === "unexplained_difference"));
});

test("CSV export escapes formulas without changing numeric negatives", () => {
  assert.equal(escapeCsv("=1+1"), "\"'=1+1\"");
  assert.equal(escapeCsv(-12), "\"-12\"");
});
