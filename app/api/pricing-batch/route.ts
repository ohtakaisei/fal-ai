import { NextRequest, NextResponse } from "next/server";
import { requireFalKey } from "@/lib/fal-key";

const BATCH_SIZE = 50;
const MAX_RETRIES = 2;

async function fetchPricingBatch(
  apiKey: string,
  endpointIds: string[]
): Promise<{ endpoint_id: string; unit_price: number }[]> {
  const params = new URLSearchParams();
  endpointIds.forEach((id) => params.append("endpoint_id", id));
  const res = await fetch(
    `https://api.fal.ai/v1/models/pricing?${params.toString()}`,
    { headers: { Authorization: `Key ${apiKey}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.prices || []).filter(
    (p: { endpoint_id?: string; unit_price?: number }) =>
      p?.endpoint_id != null && p?.unit_price != null
  );
}

export async function POST(request: NextRequest) {
  const keyResult = requireFalKey(request);
  if ("error" in keyResult) {
    return NextResponse.json({ error: keyResult.error }, { status: keyResult.status });
  }
  const apiKey = keyResult.key;

  let endpointIds: string[] = [];
  try {
    const body = await request.json();
    endpointIds = Array.isArray(body?.endpoint_ids)
      ? body.endpoint_ids.filter((id: unknown) => typeof id === "string")
      : [];
  } catch {
    return NextResponse.json(
      { error: "endpoint_ids の配列を指定してください" },
      { status: 400 }
    );
  }

  if (endpointIds.length === 0) {
    return NextResponse.json({ prices: [] });
  }

  const priceMap = new Map<string, number>();
  const batches: string[][] = [];
  for (let i = 0; i < endpointIds.length; i += BATCH_SIZE) {
    batches.push(endpointIds.slice(i, i + BATCH_SIZE));
  }

  const fetchWithRetry = async (batch: string[]) => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fetchPricingBatch(apiKey, batch);
      } catch (e) {
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        } else {
          console.warn("Pricing batch failed after retries:", (e as Error).message);
          return [];
        }
      }
    }
    return [];
  };

  const results = await Promise.all(batches.map((batch) => fetchWithRetry(batch)));
  for (const batchResults of results) {
    for (const p of batchResults) {
      priceMap.set(p.endpoint_id, p.unit_price);
    }
  }

  const prices = Array.from(priceMap.entries()).map(([endpoint_id, unit_price]) => ({
    endpoint_id,
    unit_price,
  }));

  return NextResponse.json({ prices, priceMap: Object.fromEntries(priceMap) });
}
