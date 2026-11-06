import Papa from "papaparse";
import { inspectRows, mapRows, recognizeColumns } from "./data.js";

const products = [
  { product: "Northstar Insulated Bottle", sku: "NS-BTL-01", unitPrice: 28.5 },
  { product: "Harbor Canvas Tote", sku: "HB-TOT-02", unitPrice: 34 },
  { product: "Summit Trail Mug", sku: "SM-MUG-03", unitPrice: 19.95 },
  { product: "Willow Desk Organizer", sku: "WL-ORG-04", unitPrice: 42 },
  { product: "Atlas Packing Cubes", sku: "AT-CUB-05", unitPrice: 24.5 },
  { product: "Meadow Linen Apron", sku: "MD-APR-06", unitPrice: 38 },
];

export function createDemoImports() {
  const orders = [];
  const payments = [];
  const returns = [];
  const feedback = [];
  for (let index = 1; index <= 120; index += 1) {
    const product = products[(index * 7) % products.length];
    const quantity = index % 17 === 0 ? 2 : 1;
    const date = new Date(Date.UTC(2026, (index % 8) + 1, (index % 27) + 1)).toISOString().slice(0, 10);
    const orderId = `DEMO-${String(index).padStart(4, "0")}`;
    const gross = Number((product.unitPrice * quantity).toFixed(2));
    orders.push({ orderId, ...product, quantity, amount: gross, date, additional: {} });
    const fee = Number((-gross * 0.08).toFixed(2));
    const adjustment = index === 4 ? -6 : index === 21 ? 9 : 0;
    payments.push({ orderId, amount: gross + adjustment, transactionType: "payment", date, additional: {} });
    payments.push({ orderId, amount: fee, transactionType: "fee", date, additional: {} });
    if (index <= 12) payments.push({ orderId, amount: -gross, transactionType: "refund", date, additional: {} });
    if (index === 37) payments.push({ orderId, amount: gross, transactionType: "payment", date, additional: {} });
    if ([3, 5, 6, 8, 10, 12, 14, 16, 18, 20, 23, 25, 27, 30, 32, 34, 39, 43, 48, 52, 59, 64, 71, 77].includes(index)) {
      const reasons = [
        "The fit is too small",
        "Arrived with a damaged corner",
        "The packaging was crushed",
        "A lid accessory was missing",
        "Color did not match the product description",
        "Received the wrong item",
      ];
      const reason = reasons[index % reasons.length];
      returns.push({
        orderId,
        returnId: `RET-DEMO-${String(index).padStart(4, "0")}`,
        product: product.product,
        sku: product.sku,
        quantity: 1,
        returnReason: reason,
        date,
        customerName: `Sample Buyer ${String(index).padStart(3, "0")}`,
        customerId: `DEMO-CUST-${String(index).padStart(4, "0")}`,
        customerPhone: `202-555-${String(100 + index).padStart(4, "0")}`,
        customerEmail: `buyer-${String(index).padStart(3, "0")}@example.com`,
        customerTelegram: `sample.buyer${String(index).padStart(3, "0")}`,
        marketplace: "Demo Marketplace",
        additional: {},
      });
      if (index % 2 === 0) feedback.push({ orderId, product: product.product, comment: `Customer note: ${reason.toLowerCase()}.`, date, additional: {} });
    }
  }
  const sources = {
    orders: orders.map((row) => ({ order_id: row.orderId, product_name: row.product, sku: row.sku, unit_price: row.unitPrice, quantity: row.quantity, amount: row.amount, date: row.date })),
    payments: payments.map((row) => ({ order_id: row.orderId, amount: row.amount, transaction_type: row.transactionType, date: row.date })),
    returns: returns.map((row) => ({
      return_id: row.returnId,
      order_id: row.orderId,
      product_name: row.product,
      sku: row.sku,
      quantity: row.quantity,
      return_reason: row.returnReason,
      date: row.date,
      customer_name: row.customerName,
      customer_id: row.customerId,
      customer_phone: row.customerPhone,
      customer_email: row.customerEmail,
      customer_telegram: row.customerTelegram,
      marketplace: row.marketplace,
    })),
    feedback: feedback.map((row) => ({ order_id: row.orderId, product_name: row.product, comment: row.comment, date: row.date })),
    products: products.map((row) => ({ product_name: row.product, sku: row.sku, unit_price: row.unitPrice })),
  };
  const timestamp = new Date().toISOString();
  return Object.entries(sources).map(([reportType, rawRows]) => {
    const csv = Papa.unparse(rawRows);
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: "greedy" });
    const mappings = Object.fromEntries(recognizeColumns(parsed.meta.fields).map(({ header, field }) => [header, field]));
    if (mappings.amount === "") mappings.amount = "amount";
    const standardized = mapRows(parsed.data, mappings).map((row, index) => ({ ...row, original: parsed.data[index] }));
    const analysis = inspectRows(parsed.data, standardized, reportType);
    const warnings = [];
    if (analysis.invalidIndexes.length) warnings.push(`${analysis.invalidIndexes.length} sample rows did not map a required identifier.`);
    if (reportType === "payments") warnings.push({ key: "warningDemoPayments" });
    if (reportType === "returns") warnings.push({ key: "warningDemoReturns" });
    return {
      id: crypto.randomUUID(),
      fileName: `${reportType}_sample.csv`,
      reportType,
      importedAt: timestamp,
      rows: standardized,
      warnings,
      isDemo: true,
      sourceHeaders: parsed.meta.fields,
    };
  });
}

export function createDemoSources() {
  const imports = createDemoImports();
  return imports.map(({ fileName, sourceHeaders, rows }) => {
    const rawRows = rows.map((row) => {
      const source = {};
      for (const header of sourceHeaders) {
        const field = recognizeColumns([header])[0].field || (header === "amount" ? "amount" : "");
        source[header] = field ? row[field] ?? "" : row.additional?.[header] ?? "";
      }
      return source;
    });
    return { fileName, rawRows };
  });
}
