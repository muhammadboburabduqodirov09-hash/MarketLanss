import { NextResponse } from "next/server";
import {
  buildDeepSeekMessages,
  inventoryAnalysisRequestSchema,
  inventoryAnalysisResponseSchema,
} from "@/lib/deepseek-analysis";

export const runtime = "nodejs";

function jsonResponse(data, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  return jsonResponse({ configured: Boolean(process.env.DEEPSEEK_API_KEY?.trim()) });
}

export async function POST(request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return jsonResponse({ error: "Cross-origin analytics requests are not allowed." }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse({ error: "Send the analysis request as JSON." }, 415);
  }

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return jsonResponse({ error: "DeepSeek is not configured. Add DEEPSEEK_API_KEY to .env.local and restart the app." }, 503);

  const body = await request.text();
  if (body.length > 256000) return jsonResponse({ error: "The analysis input is too large." }, 413);

  let input;
  try {
    input = JSON.parse(body);
  } catch {
    return jsonResponse({ error: "The analysis request contains invalid JSON." }, 400);
  }
  const parsed = inventoryAnalysisRequestSchema.safeParse(input);
  if (!parsed.success) return jsonResponse({ error: "The inventory data is invalid or exceeds the supported limits." }, 400);

  const messages = buildDeepSeekMessages({
    ...parsed.data,
    currentMonth: new Date().toISOString().slice(0, 7),
  });

  let providerResponse;
  try {
    providerResponse = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 2200,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    });
  } catch (error) {
    const message = error.name === "TimeoutError"
      ? "DeepSeek took too long to respond. Please try again."
      : "Could not connect to DeepSeek. Check your internet connection and try again.";
    return jsonResponse({ error: message }, 502);
  }

  if (!providerResponse.ok) {
    console.error(`DeepSeek analytics request failed with HTTP ${providerResponse.status}.`);
    return jsonResponse({ error: "DeepSeek could not complete the analysis. Check the API key and account status." }, 502);
  }

  let providerData;
  try {
    providerData = await providerResponse.json();
  } catch {
    return jsonResponse({ error: "DeepSeek returned an unreadable response." }, 502);
  }
  const content = providerData?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return jsonResponse({ error: "DeepSeek returned an empty analysis." }, 502);

  let result;
  try {
    result = JSON.parse(content);
  } catch {
    return jsonResponse({ error: "DeepSeek returned an invalid analysis format. Please try again." }, 502);
  }
  const validatedResult = inventoryAnalysisResponseSchema.safeParse(result);
  if (!validatedResult.success) return jsonResponse({ error: "DeepSeek returned an incomplete analysis. Please try again." }, 502);

  return jsonResponse(validatedResult.data);
}
