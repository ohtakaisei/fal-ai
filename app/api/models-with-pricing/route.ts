import { NextRequest, NextResponse } from "next/server";
import { getFalKeyFromRequest } from "@/lib/fal-key";

export interface FalModelWithPrice {
  endpoint_id: string;
  unit_price?: number;
  metadata: {
    display_name: string;
    category: string;
    description: string;
    status?: string;
    tags?: string[];
    thumbnail_url?: string;
  };
}

export async function GET(request: NextRequest) {
  const apiKey = getFalKeyFromRequest(request);
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") || "200";

  if (!apiKey) {
    return NextResponse.json(
      { error: "fal.ai APIキーが設定されていません。画面上でキーを入力してください。" },
      { status: 401 }
    );
  }

  try {
    // 1. モデル一覧を取得
    const modelsRes = await fetch(
      `https://api.fal.ai/v1/models?limit=${limit}`,
      { headers: { Authorization: `Key ${apiKey}` } }
    );
    if (!modelsRes.ok) {
      const err = await modelsRes.text();
      return NextResponse.json(
        { error: `fal.ai API error: ${modelsRes.status}`, details: err },
        { status: modelsRes.status }
      );
    }
    const modelsData = await modelsRes.json();
    const models = modelsData.models || [];

    if (models.length === 0) {
      return NextResponse.json({ models: [] });
    }

    // 2. 料金を一括取得（50件ずつバッチ、並列実行）
    const BATCH = 50;
    const priceMap = new Map<string, number>();
    const batches: { endpoint_id: string }[][] = [];
    for (let i = 0; i < models.length; i += BATCH) {
      batches.push(models.slice(i, i + BATCH));
    }
    const pricingResults = await Promise.all(
      batches.map(async (batch) => {
        const params = new URLSearchParams();
        batch.forEach((m: { endpoint_id: string }) =>
          params.append("endpoint_id", m.endpoint_id)
        );
        const res = await fetch(
          `https://api.fal.ai/v1/models/pricing?${params.toString()}`,
          { headers: { Authorization: `Key ${apiKey}` } }
        );
        return res.ok ? res.json() : { prices: [] };
      })
    );
    for (const data of pricingResults) {
      for (const p of data.prices || []) {
        if (p.endpoint_id != null && p.unit_price != null) {
          priceMap.set(p.endpoint_id, p.unit_price);
        }
      }
    }

    // 3. モデルに料金を付与
    const modelsWithPrice: FalModelWithPrice[] = models.map(
      (m: { endpoint_id: string; metadata?: object }) => ({
        ...m,
        unit_price: priceMap.get(m.endpoint_id),
      })
    );

    return NextResponse.json({ models: modelsWithPrice });
  } catch (error) {
    console.error("Models with pricing error:", error);
    return NextResponse.json(
      { error: "モデル一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
