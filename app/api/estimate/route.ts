import { NextRequest, NextResponse } from "next/server";
import { requireFalKey } from "@/lib/fal-key";

export const dynamic = "force-dynamic";

// 生成前のコスト見積もり
// POST https://api.fal.ai/v1/models/pricing/estimate
// unit_price（単価×生成数）を優先し、失敗時は historical_api_price（過去実績ベース）にフォールバック
export async function POST(request: NextRequest) {
  const keyResult = requireFalKey(request);
  if ("error" in keyResult) {
    return NextResponse.json({ error: keyResult.error }, { status: keyResult.status });
  }
  const apiKey = keyResult.key;

  let endpointId = "";
  let quantity = 1;
  try {
    const body = await request.json();
    endpointId = typeof body?.endpoint_id === "string" ? body.endpoint_id : "";
    const q = Number(body?.quantity);
    quantity = Number.isFinite(q) && q > 0 ? q : 1;
  } catch {
    // fallthrough
  }
  if (!endpointId) {
    return NextResponse.json({ error: "endpoint_id を指定してください" }, { status: 400 });
  }

  const callEstimate = async (payload: object) => {
    const res = await fetch("https://api.fal.ai/v1/models/pricing/estimate", {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.total_cost === "number"
      ? { totalCost: data.total_cost, currency: data.currency ?? "USD" }
      : null;
  };

  try {
    // 1. 単価ベース（生成数を billing unit として見積もり）
    const unitResult = await callEstimate({
      estimate_type: "unit_price",
      endpoints: { [endpointId]: { unit_quantity: quantity } },
    });
    if (unitResult && unitResult.totalCost > 0) {
      return NextResponse.json({ ...unitResult, method: "unit_price" });
    }

    // 2. 過去実績ベース（このアカウントの平均コスト/回 × 回数）※整数のみ
    const histResult = await callEstimate({
      estimate_type: "historical_api_price",
      endpoints: { [endpointId]: { call_quantity: Math.max(1, Math.round(quantity)) } },
    });
    if (histResult && histResult.totalCost > 0) {
      return NextResponse.json({ ...histResult, method: "historical" });
    }

    return NextResponse.json({ totalCost: null });
  } catch (e) {
    console.error("Estimate API error:", e);
    return NextResponse.json({ error: "見積もりの取得に失敗しました" }, { status: 500 });
  }
}
