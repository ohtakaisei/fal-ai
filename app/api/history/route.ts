import { NextRequest, NextResponse } from "next/server";
import { requireFalKey } from "@/lib/fal-key";

export const dynamic = "force-dynamic";

// fal.ai 上の過去リクエスト履歴を取得
// GET https://api.fal.ai/v1/models/requests/by-endpoint
// endpoint_id は最大50件/リクエストのため、50件ずつチャンクして並列取得しマージする
const CHUNK_SIZE = 50;

export interface HistoryItem {
  request_id: string;
  endpoint_id: string;
  started_at: string;
  sent_at: string;
  ended_at?: string | null;
  status_code?: number | null;
  duration?: number | null;
  json_input?: unknown;
  json_output?: unknown;
}

export async function GET(request: NextRequest) {
  const keyResult = requireFalKey(request);
  if ("error" in keyResult) {
    return NextResponse.json({ error: keyResult.error }, { status: keyResult.status });
  }
  const apiKey = keyResult.key;

  const { searchParams } = new URL(request.url);
  const endpointIdsRaw = searchParams.get("endpoint_ids") || "";
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const status = searchParams.get("status"); // success | error | user_error

  const endpointIds = Array.from(
    new Set(
      endpointIdsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );

  if (endpointIds.length === 0) {
    return NextResponse.json(
      { error: "endpoint_ids を指定してください" },
      { status: 400 }
    );
  }

  const chunks: string[][] = [];
  for (let i = 0; i < endpointIds.length; i += CHUNK_SIZE) {
    chunks.push(endpointIds.slice(i, i + CHUNK_SIZE));
  }

  const fetchChunk = async (ids: string[]): Promise<HistoryItem[]> => {
    const params = new URLSearchParams();
    params.set("endpoint_id", ids.join(","));
    params.set("limit", "100");
    params.set("expand", "payloads");
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (status) params.set("status", status);

    try {
      const res = await fetch(
        `https://api.fal.ai/v1/models/requests/by-endpoint?${params.toString()}`,
        {
          headers: { Authorization: `Key ${apiKey}` },
          cache: "no-store",
        }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.items) ? data.items : [];
    } catch {
      return [];
    }
  };

  try {
    const results = await Promise.all(chunks.map(fetchChunk));
    const seen = new Set<string>();
    const items: HistoryItem[] = [];
    for (const chunk of results) {
      for (const item of chunk) {
        if (item?.request_id && !seen.has(item.request_id)) {
          seen.add(item.request_id);
          items.push(item);
        }
      }
    }
    // 新しい順
    items.sort((a, b) => {
      const ta = a.ended_at || a.started_at || "";
      const tb = b.ended_at || b.started_at || "";
      return tb.localeCompare(ta);
    });

    return NextResponse.json({ items });
  } catch (e) {
    console.error("History API error:", e);
    return NextResponse.json({ error: "履歴の取得に失敗しました" }, { status: 500 });
  }
}
