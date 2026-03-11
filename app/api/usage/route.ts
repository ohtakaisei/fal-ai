import { NextRequest, NextResponse } from "next/server";
import { requireFalKey } from "@/lib/fal-key";

// 累計コストを取得（fal.aiの過去使用量ベースの見積もり）
export async function GET(request: NextRequest) {
  const keyResult = requireFalKey(request);
  if ("error" in keyResult) {
    return NextResponse.json({ error: keyResult.error }, { status: keyResult.status });
  }
  const apiKey = keyResult.key;

  try {
    const res = await fetch("https://api.fal.ai/v1/models/pricing/estimate", {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        estimate_type: "historical_api_price",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      // 400/403等はfal.aiの仕様（未使用アカウント等）のため、エラーではなく0を返す
      if (res.status >= 400) {
        return NextResponse.json({ totalCost: 0, currency: "USD" });
      }
      return NextResponse.json(
        { error: `fal.ai API error: ${res.status}`, details: err },
        { status: 500 }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      totalCost: data.total_cost ?? 0,
      currency: data.currency ?? "USD",
    });
  } catch (e) {
    console.error("Usage API error:", e);
    return NextResponse.json(
      { error: "使用量の取得に失敗しました" },
      { status: 500 }
    );
  }
}
