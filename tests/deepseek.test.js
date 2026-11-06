import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDeepSeekMessages,
  buildDeepSeekRequest,
  inventoryAnalysisRequestSchema,
  inventoryAnalysisResponseSchema,
  parseDeepSeekJson,
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

test("DeepSeek uses a valid production model and a string-only messages array without unsupported parameters", () => {
  const messages = buildDeepSeekMessages({
    language: "ru",
    marketSeasonContext: "Northern Hemisphere",
    currentMonth: "2026-11",
    products: [sampleProduct],
  });
  const body = buildDeepSeekRequest(messages);
  assert.equal(body.model, "deepseek-chat");
  assert.ok(Array.isArray(body.messages) && body.messages.length > 0);
  assert.ok(body.messages.every((message) =>
    ["system", "user", "assistant", "tool"].includes(message.role)
    && typeof message.content === "string"));
  assert.equal("response_format" in body, false);
  assert.equal("temperature" in body, false);
  assert.equal("max_tokens" in body, false);
  assert.match(messages[0].content, /Russian/);
  assert.match(messages[0].content, /at least two years/);
  assert.match(messages[0].content, /untrusted data/);
  assert.match(messages[1].content, /2026-11/);
  assert.match(messages[1].content, /Northern Hemisphere/);
});

test("DeepSeek JSON output parser accepts plain JSON and fenced JSON", () => {
  const result = { summary: "Review stock.", recommendations: [] };
  assert.deepEqual(parseDeepSeekJson(JSON.stringify(result)), result);
  assert.deepEqual(parseDeepSeekJson(`\`\`\`json\n${JSON.stringify(result)}\n\`\`\``), result);
  assert.throws(() => parseDeepSeekJson("not json"));
});

test("DeepSeek analysis response must follow the expected display shape", () => {
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
