import { NextRequest, NextResponse } from "next/server";
import { requireFalKey } from "@/lib/fal-key";

export interface PriceItem {
  endpoint_id: string;
  unit_price: number;
  unit: string;
  currency: string;
}

export async function GET(request: NextRequest) {
  const keyResult = requireFalKey(request);
  if ("error" in keyResult) {
    return NextResponse.json({ error: keyResult.error }, { status: keyResult.status });
  }
  const apiKey = keyResult.key;

  const { searchParams } = new URL(request.url);
  const endpointIds = searchParams.getAll("endpoint_id");
  if (endpointIds.length === 0) {
    return NextResponse.json(
      { error: "endpoint_idを指定してください" },
      { status: 400 }
    );
  }

  const params = new URLSearchParams();
  endpointIds.forEach((id) => params.append("endpoint_id", id));

  try {
    const res = await fetch(
      `https://api.fal.ai/v1/models/pricing?${params.toString()}`,
      {
        headers: { Authorization: `Key ${apiKey}` },
      }
    );
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `fal.ai API error: ${res.status}`, details: err },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("Pricing API error:", e);
    return NextResponse.json(
      { error: "料金の取得に失敗しました" },
      { status: 500 }
    );
  }
}
