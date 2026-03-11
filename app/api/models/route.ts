import { NextRequest, NextResponse } from "next/server";
import { getFalKeyFromRequest } from "@/lib/fal-key";

export interface FalModel {
  endpoint_id: string;
  metadata: {
    display_name: string;
    category: string;
    description: string;
    status?: string;
    tags?: string[];
    thumbnail_url?: string;
    model_url?: string;
  };
}

export interface ModelsResponse {
  models: FalModel[];
  next_cursor: string | null;
  has_more: boolean;
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.FAL_KEY;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const category = searchParams.get("category");
  const q = searchParams.get("q");
  const limit = searchParams.get("limit") || "100";

  const params = new URLSearchParams();
  params.set("limit", limit);
  if (cursor) params.set("cursor", cursor);
  if (category) params.set("category", category);
  if (q) params.set("q", q);

  try {
    const apiKey = getFalKeyFromRequest(request);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Key ${apiKey}`;
    }

    const response = await fetch(
      `https://api.fal.ai/v1/models?${params.toString()}`,
      { headers }
    );

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `fal.ai API error: ${response.status}`, details: error },
        { status: response.status }
      );
    }

    const data: ModelsResponse = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Models API error:", error);
    return NextResponse.json(
      { error: "モデル一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
