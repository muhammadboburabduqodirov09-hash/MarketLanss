import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDeepSeekMessages,
  inventoryAnalysisRequestSchema,
  inventoryAnalysisResponseSchema,
} from "../src/lib/deepseek-analysis.js";

const sampleProduct = {
  name: "Desk lamp",
  sku: "L-1",
  stock: 12,
  averageMonthlyDemand: 4,
  latestMonth: "2026-03",
  latestUnits: 6,
  change: 0.5,
  monthlySalesHistory: [
    { month: "2026-02", units: 2 },
    { month: "2026-03", units: 6 },
  ],
};

test("DeepSeek request schema excludes customer data and validates bounded sales summaries", () => {
  const parsed = inventoryAnalysisRequestSchema.safeParse({
    language: "en",
    marketSeasonContext: "US, Northern Hemisphere",
    products: [{ ...sampleProduct, customerEmail: "private@example.com" }],
  });
  assert.equal(parsed.success, true);
  assert.equal("customerEmail" in parsed.data.products[0], false);
  assert.equal(inventoryAnalysisRequestSchema.safeParse({
    language: "en",
    products: [{ ...sampleProduct, monthlySalesHistory: Array(25).fill({ month: "2026-01", units: 1 }) }],
  }).success, false);
});

test("DeepSeek prompt asks for evidence-based seasonal advice in the selected language", () => {
  const messages = buildDeepSeekMessages({
    language: "ru",
    marketSeasonContext: "Northern Hemisphere",
    currentMonth: "2026-11",
    products: [sampleProduct],
  });
  assert.match(messages[0].content, /Russian/);
  assert.match(messages[0].content, /at least two years/);
  assert.match(messages[0].content, /untrusted data/);
  assert.match(messages[1].content, /2026-11/);
  assert.match(messages[1].content, /Northern Hemisphere/);
});

test("DeepSeek analysis response must follow the expected safe display shape", () => {
  const valid = {
    summary: "Stock is adequate for current recorded demand.",
    recommendations: [{
      title: "Review next month's stock",
      action: "Compare incoming stock with recent monthly sales before reordering.",
      evidence: "Two dated monthly sales totals are available.",
      confidence: "low",
    }],
  };
  assert.equal(inventoryAnalysisResponseSchema.safeParse(valid).success, true);
  assert.equal(inventoryAnalysisResponseSchema.safeParse({
    ...valid,
    recommendations: [{ ...valid.recommendations[0], confidence: "certain" }],
  }).success, false);
});
