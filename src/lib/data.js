import Papa from "papaparse";
import * as XLSX from "@e965/xlsx";

export const reportTypes = [
  "orders",
  "payments",
  "returns",
  "products",
  "feedback",
];

export const reportLabels = {
  orders: "Orders",
  payments: "Payments / settlement",
  returns: "Returns",
  products: "Products / inventory",
  feedback: "Customer feedback",
};

export const fields = {
  product: "Product name",
  sku: "SKU",
  orderId: "Order ID",
  returnId: "Return ID",
  quantity: "Quantity",
  unitPrice: "Unit price",
  amount: "Amount",
  fee: "Fee",
  transactionType: "Transaction type",
  date: "Date",
  returnReason: "Return reason",
  customerFeedback: "Full customer feedback",
  status: "Return status",
  customerName: "Customer name",
  customerId: "Customer ID",
  customerPhone: "Customer phone",
  customerEmail: "Customer email",
  customerTelegram: "Customer Telegram",
  marketplace: "Marketplace",
  marketplaceConversationUrl: "Marketplace conversation URL",
  marketplaceAccountUrl: "Marketplace account URL",
  stockQuantity: "Current stock",
  refund: "Refund amount",
  comment: "Customer comment",
};

const aliases = {
  product: ["product", "productname", "itemtitle", "title", "itemname", "name"],
  sku: ["sku", "sellersku", "productsku", "itemid", "productid"],
  orderId: ["orderid", "ordernumber", "transactionid", "referenceid", "order", "orderno", "marketplaceorderid"],
  returnId: ["returnid", "returnnumber", "returnreference", "returnref", "rmanumber", "rma"],
  quantity: ["quantity", "qty", "units", "count"],
  unitPrice: ["unitprice", "price", "itemprice", "sellingprice", "priceperunit"],
  amount: ["amount", "total", "payout", "paymentamount", "transactionamount", "gross"],
  fee: ["fee", "fees", "commission", "marketplacefee"],
  transactionType: ["transactiontype", "type", "category", "transaction", "event"],
  date: ["date", "orderdate", "transactiondate", "createdat", "returndate", "requestdate"],
  returnReason: ["returnreason", "reason", "refundreason", "complaint", "returncomment", "reasonforreturn", "returncause", "reasonreturned", "returnreasontext"],
  customerFeedback: ["customerfeedback", "customerexplanation", "customerresponse", "customerreason", "returnexplanation", "fullfeedback", "customerfeedbacktext", "customerfeedbackmessage"],
  status: ["status", "returnstatus", "refundstatus", "resolutionstatus"],
  customerName: ["customername", "buyername", "recipientname"],
  customerId: ["customerid", "buyerid", "clientid"],
  customerPhone: ["customerphone", "phone", "phonenumber", "buyerphone", "telephone"],
  customerEmail: ["customeremail", "email", "emailaddress", "buyeremail"],
  customerTelegram: ["customertelegram", "telegram", "telegramusername", "telegramhandle"],
  marketplace: ["marketplace", "platform", "channel", "marketplacename"],
  marketplaceConversationUrl: ["marketplaceconversationurl", "conversationurl", "conversationlink", "chaturl", "messagelink", "returnconversationurl"],
  marketplaceAccountUrl: ["marketplaceaccounturl", "customeraccounturl", "buyerprofileurl", "accounturl"],
  stockQuantity: ["stock", "stockquantity", "currentstock", "inventory", "inventoryquantity", "inventorylevel", "availablestock", "availablequantity", "availableunits", "stockonhand", "stocklevel", "quantityinstock", "onhand"],
  refund: ["refund", "refundamount", "refundedamount"],
  comment: ["comment", "feedback", "customercomment", "review", "message"],
};

const normalizeHeader = (value) =>
  String(value ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

export function recognizeColumns(headers) {
  return headers.map((header) => {
    const normalized = normalizeHeader(header);
    const matches = Object.entries(aliases).filter(([, values]) =>
      values.some((value) => normalizeHeader(value) === normalized),
    );
    const field = matches.length === 1 ? matches[0][0] : "";
    const ambiguous = normalized === "amount" || normalized === "total";
    return {
      header,
      field: ambiguous ? "" : field,
      confidence: ambiguous ? "low" : field ? "high" : "low",
    };
  });
}

export async function parseUpload(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["csv", "xlsx", "xls"].includes(extension)) {
    throw new Error("Choose a CSV, XLSX, or XLS file.");
  }
  if (file.size > 10 * 1024 * 1024) throw new Error("Files must be 10 MB or smaller.");
  let rows;
  let parseWarnings = [];
  if (extension === "csv") {
    const text = await file.text();
    const result = Papa.parse(text.replace(/^\uFEFF/, ""), {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
    });
    if (result.errors.length) {
      const fatal = result.errors.find((error) => error.type === "Quotes" || error.type === "Delimiter");
      if (fatal) throw new Error(`Could not parse CSV: ${fatal.message}`);
      parseWarnings = result.errors.slice(0, 100).map((error) => `Row ${error.row + 1}: ${error.message}`);
    }
    rows = result.data;
  } else {
    const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true, cellFormula: false });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) throw new Error("The workbook has no readable worksheets.");
    rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "", raw: false });
  }
  const data = rows.filter((row) => Object.values(row).some((value) => String(value ?? "").trim()));
  if (!data.length) throw new Error("The file has no usable data rows.");
  if (data.length > 100000) throw new Error("Files may contain at most 100,000 data rows.");
  const headers = Object.keys(data[0]);
  if (!headers.length || headers.every((header) => !header.trim())) {
    throw new Error("The file needs a header row.");
  }
  return { headers, rows: data, parseWarnings };
}

export function normalizeNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined || String(value).trim() === "") return null;
  let text = String(value).trim().replace(/[^\d,.\-+()]/g, "");
  const negativeParentheses = text.startsWith("(") && text.endsWith(")");
  text = text.replace(/[()]/g, "");
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > lastDot) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else {
    text = text.replace(/,/g, "");
  }
  if (!/\d/.test(text)) return null;
  const result = Number(text);
  if (!Number.isFinite(result)) return null;
  return negativeParentheses ? -Math.abs(result) : result;
}

export function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  if (value === null || value === undefined || String(value).trim() === "") return "";
  const source = String(value).trim();
  const us = source.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (us) {
    const [, first, second, rawYear] = us;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    const day = Number(first) > 12 ? first : second;
    const month = Number(first) > 12 ? second : first;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function normalizeTransactionType(value) {
  const text = String(value ?? "").toLowerCase();
  if (/refund|return/.test(text)) return "refund";
  if (/fee|commission/.test(text)) return "fee";
  if (/adjust/.test(text)) return "adjustment";
  return "payment";
}

export function mapRows(rows, mappings) {
  return rows.map((row) => {
    const result = { additional: {} };
    for (const [header, field] of Object.entries(mappings)) {
      if (!field) {
        if (row[header] !== "" && row[header] !== null && row[header] !== undefined) result.additional[header] = row[header];
        continue;
      }
      const value = row[header];
      if (["quantity", "unitPrice", "amount", "fee", "refund"].includes(field)) result[field] = normalizeNumber(value);
      else if (field === "stockQuantity") result[field] = normalizeNumber(value);
      else if (field === "date") result.date = normalizeDate(value);
      else if (["returnReason", "customerFeedback", "comment"].includes(field)) result[field] = value === null || value === undefined ? "" : String(value);
      else result[field] = value === null || value === undefined ? "" : String(value).trim();
    }
    if (result.transactionType) result.transactionType = normalizeTransactionType(result.transactionType);
    if (result.transactionType === "fee" && result.amount > 0) result.amount *= -1;
    if (result.transactionType === "refund" && result.amount > 0) result.amount *= -1;
    if (result.fee > 0) result.fee *= -1;
    if (result.refund > 0) result.refund *= -1;
    return result;
  });
}

export function inspectRows(rows, mappedRows, reportType) {
  const seen = new Set();
  const duplicateIndexes = [];
  mappedRows.forEach((row, index) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) duplicateIndexes.push(index);
    seen.add(key);
  });
  const invalidIndexes = mappedRows.flatMap((row, index) => {
    const missingIdentity = reportType === "returns"
      ? !String(row.orderId ?? "").trim() || ![row.returnReason, row.customerFeedback, row.comment].some((value) => String(value ?? "").trim())
      : (reportType === "orders" || reportType === "payments" ? ["orderId"] : reportType === "products" ? ["product"] : ["comment"])
        .some((field) => !String(row[field] ?? "").trim());
    const missingFinancialValue = reportType === "orders"
      ? (row.amount === null || row.amount === undefined) && (
        row.unitPrice === null || row.unitPrice === undefined || row.quantity === null || row.quantity === undefined
      )
      : reportType === "payments" && (row.amount === null || row.amount === undefined);
    return missingIdentity || missingFinancialValue ? [index] : [];
  });
  const missingValues = mappedRows.reduce((total, row) =>
    total + Object.entries(row).filter(([key, value]) => key !== "additional" && (value === null || value === "")).length, 0,
  );
  const headers = Object.keys(rows[0] ?? {});
  const emptyColumns = headers.filter((header) => rows.every((row) => row[header] === null || row[header] === undefined || String(row[header]).trim() === ""));
  return {
    rowCount: mappedRows.length,
    duplicateIndexes,
    invalidIndexes,
    validCount: mappedRows.length - invalidIndexes.length,
    missingValues,
    emptyColumns,
  };
}

export function analyzeColumnTypes(rows) {
  const headers = Object.keys(rows[0] ?? {});
  return Object.fromEntries(headers.map((header) => {
    const values = rows.map((row) => row[header]).filter((value) => value !== null && value !== undefined && String(value).trim() !== "");
    if (!values.length) return [header, "empty"];
    const recognized = recognizeColumns([header])[0].field;
    if (["product", "sku", "orderId", "transactionType", "returnReason", "customerFeedback", "comment", "status", "customerName", "customerId", "customerPhone", "customerEmail", "customerTelegram", "marketplace", "marketplaceConversationUrl", "marketplaceAccountUrl", "returnId"].includes(recognized)) return [header, "text"];
    const dates = values.filter((value) => typeof value === "string" && /[-/]|T/.test(value) && Boolean(normalizeDate(value))).length;
    const numeric = values.filter((value) => normalizeNumber(value) !== null).length;
    const type = dates === values.length ? "date" : numeric === values.length ? "number" : (numeric || dates) ? "mixed" : "text";
    return [header, type];
  }));
}

export function calculatePaymentAudit(imports) {
  const orders = imports.filter((item) => item.reportType === "orders").flatMap((item) => item.rows);
  const transactions = imports.filter((item) => item.reportType === "payments").flatMap((item) => item.rows);
  const orderMap = new Map();
  for (const order of orders) {
    if (!order.orderId) continue;
    const amount = order.amount ?? (
      Number.isFinite(order.unitPrice) && Number.isFinite(order.quantity)
        ? order.unitPrice * order.quantity
        : null
    );
    if (!Number.isFinite(amount)) continue;
    const current = orderMap.get(order.orderId) ?? { orderId: order.orderId, gross: 0, date: order.date };
    current.gross += amount;
    orderMap.set(order.orderId, current);
  }
  const txnMap = new Map();
  const unmatched = [];
  transactions.forEach((txn, index) => {
    if (!txn.orderId || !orderMap.has(txn.orderId)) {
      unmatched.push({ ...txn, amount: txn.amount ?? txn.fee ?? txn.refund, key: `unmatched-${index}` });
      return;
    }
    const type = txn.transactionType || "payment";
    const group = txnMap.get(txn.orderId) ?? { transactions: [], paymentCount: 0, adjustments: 0, actual: 0, paymentTotal: 0 };
    group.transactions.push(txn);
    const transactionAmount = txn.amount ?? (type === "fee" ? txn.fee : type === "refund" ? txn.refund : 0) ?? 0;
    group.actual += transactionAmount;
    if (type === "payment") {
      group.paymentCount += 1;
      group.paymentTotal += txn.amount ?? 0;
      group.adjustments += (txn.fee ?? 0) + (txn.refund ?? 0);
    } else group.adjustments += transactionAmount;
    txnMap.set(txn.orderId, group);
  });
  const rows = [...orderMap.values()].map((order) => {
    const group = txnMap.get(order.orderId);
    const expected = order.gross + (group?.adjustments ?? 0);
    const actual = group?.actual ?? 0;
    const difference = actual - expected;
    let status = "matched";
    if (!group) status = "unmatched";
    else if (group.paymentCount > 1) status = "possible_duplicate";
    else if (Math.abs(difference) > 0.01 && group.paymentTotal > 0 && group.paymentTotal + 0.01 < order.gross) status = "partially_matched";
    else if (Math.abs(difference) > 0.01) status = "unexplained_difference";
    else if (order.date && group.transactions.some((txn) => txn.date && (new Date(`${txn.date}T00:00:00Z`) - new Date(`${order.date}T00:00:00Z`)) / 86400000 > 30)) status = "timing_difference";
    return { ...order, expected, actual, difference, status, transactions: group?.transactions ?? [] };
  });
  const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
  return {
    rows: [...rows, ...unmatched.map((row) => ({
      orderId: row.orderId || "—", gross: 0, expected: 0, actual: row.amount ?? 0,
      difference: row.amount ?? 0, status: "unmatched", transactions: [row],
    }))],
    expectedTotal: sum("expected"),
    actualTotal: sum("actual") + unmatched.reduce((total, row) => total + (row.amount ?? 0), 0),
    differenceTotal: sum("actual") - sum("expected") + unmatched.reduce((total, row) => total + (row.amount ?? 0), 0),
    matchedCount: rows.filter((row) => row.status === "matched").length,
    discrepancyCount: rows.filter((row) => row.status !== "matched").length + unmatched.length,
    orderCount: orderMap.size,
    hasUsableOrders: orderMap.size > 0,
    hasUsablePayments: transactions.some((row) => row.amount !== null && row.amount !== undefined),
  };
}

export function categorizeReturn(text = "") {
  const value = String(text).toLowerCase();
  if (/size|small|large|fit|tight|loose/.test(value)) return "Incorrect size";
  if (/damag|broken|defect|crack/.test(value)) return "Damaged product";
  if (/packag|box|shipping|ship/.test(value)) return "Packaging issue";
  if (/missing|accessor|part/.test(value)) return "Missing accessories";
  if (/descript|photo|picture|not as described/.test(value)) return "Incorrect description";
  if (/wrong|different item/.test(value)) return "Wrong item";
  return text.trim() ? "Other" : "Unknown";
}

export function calculateReturns(imports) {
  const records = imports.filter((item) => item.reportType === "returns").flatMap((item) =>
    item.rows.map((row, rowIndex) => ({ ...row, _importId: item.id, _rowIndex: rowIndex, category: row.category || categorizeReturn(row.returnReason || row.customerFeedback || row.comment) })),
  );
  const orders = imports.filter((item) => item.reportType === "orders").flatMap((item) => item.rows);
  const orderIds = new Set(orders.map((row) => row.orderId).filter(Boolean));
  const returnedOrderIds = new Set(records.map((row) => row.orderId).filter((orderId) => orderIds.has(orderId)));
  const feedback = imports.filter((item) => item.reportType === "feedback").flatMap((item) =>
    item.rows.map((row) => ({ ...row, category: categorizeReturn(row.comment) })),
  );
  const productCounts = new Map();
  const categoryCounts = new Map();
  const trendCounts = new Map();
  records.forEach((row) => {
    const product = row.product || row.sku || "Unspecified product";
    productCounts.set(product, (productCounts.get(product) ?? 0) + (row.quantity ?? 1));
    categoryCounts.set(row.category, (categoryCounts.get(row.category) ?? 0) + 1);
    if (row.date) {
      const month = row.date.slice(0, 7);
      trendCounts.set(month, (trendCounts.get(month) ?? 0) + 1);
    }
  });
  return {
    records,
    totalReturns: records.reduce((total, row) => total + (row.quantity ?? 1), 0),
    returnRate: orderIds.size ? returnedOrderIds.size / orderIds.size : null,
    orderCount: orderIds.size,
    returnedOrderCount: returnedOrderIds.size,
    productCounts: [...productCounts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    categoryCounts: [...categoryCounts].map(([name, value]) => ({ name, value })),
    trendCounts: [...trendCounts].map(([month, returns]) => ({ month, returns })).sort((a, b) => a.month.localeCompare(b.month)),
    feedbackPatterns: [...feedback.reduce((counts, row) => counts.set(row.category, (counts.get(row.category) ?? 0) + 1), new Map())]
      .map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    feedbackCount: feedback.length,
  };
}

export function calculateInventoryInsights(imports) {
  const products = new Map();
  const productKey = (row) => row.sku || row.product;
  const getProduct = (row) => {
    const key = productKey(row);
    if (!key) return null;
    if (!products.has(key)) products.set(key, {
      key,
      name: row.product || key,
      sku: row.sku || "",
      stock: null,
      monthlySales: new Map(),
    });
    const product = products.get(key);
    if (!product.name && row.product) product.name = row.product;
    if (!product.sku && row.sku) product.sku = row.sku;
    return product;
  };

  imports.filter((item) => item.reportType === "products").flatMap((item) => item.rows).forEach((row) => {
    const product = getProduct(row);
    if (product && Number.isFinite(row.stockQuantity)) product.stock = row.stockQuantity;
  });
  imports.filter((item) => item.reportType === "orders").flatMap((item) => item.rows).forEach((row) => {
    const product = getProduct(row);
    if (!product || !row.date || !/^\d{4}-\d{2}/.test(row.date)) return;
    const month = row.date.slice(0, 7);
    const units = Number.isFinite(row.quantity) ? row.quantity : 1;
    product.monthlySales.set(month, (product.monthlySales.get(month) ?? 0) + units);
  });

  return [...products.values()].map((product) => {
    const months = [...product.monthlySales].sort(([first], [second]) => first.localeCompare(second));
    const latest = months.at(-1);
    const previous = months.at(-2);
    const change = latest && previous && previous[1] > 0 ? (latest[1] - previous[1]) / previous[1] : null;
    const latestThreeMonths = months.slice(-3);
    const averageMonthlyDemand = latestThreeMonths.length
      ? latestThreeMonths.reduce((total, [, units]) => total + units, 0) / latestThreeMonths.length
      : null;
    let recommendation = "No dated order history is available for this product.";
    let tone = "neutral";
    if (product.stock !== null && averageMonthlyDemand !== null && averageMonthlyDemand > 0 && product.stock <= averageMonthlyDemand) {
      recommendation = `Current stock (${product.stock}) is at or below recent monthly demand (${averageMonthlyDemand.toFixed(1)} units). Consider restocking.`;
      tone = "warning";
    } else if (change !== null && change >= 0.25 && latest[1] >= 2) {
      recommendation = `Sales increased ${Math.round(change * 100)}% in the latest recorded month. Review stock before the next period.`;
      tone = "success";
    } else if (product.stock !== null && averageMonthlyDemand !== null) {
      recommendation = `Current stock (${product.stock}) is above recent monthly demand (${averageMonthlyDemand.toFixed(1)} units).`;
    } else if (months.length) {
      recommendation = "Demand history is available; import current inventory to estimate replenishment needs.";
    }
    return {
      ...product,
      latestMonth: latest?.[0] || "",
      latestUnits: latest?.[1] ?? null,
      monthlySalesHistory: months.slice(-24).map(([month, units]) => ({ month, units })),
      change,
      recommendation,
      tone,
    };
  }).sort((first, second) => {
    const priority = (item) => item.tone === "warning" ? 0 : item.tone === "success" ? 1 : 2;
    return priority(first) - priority(second) || (second.change ?? -Infinity) - (first.change ?? -Infinity);
  });
}

export function escapeCsv(value) {
  const text = String(value ?? "");
  const safe = typeof value !== "number" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function makeCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [headers.map(escapeCsv).join(","), ...rows.map((row) => headers.map((key) => escapeCsv(row[key])).join(","))].join("\r\n");
}
