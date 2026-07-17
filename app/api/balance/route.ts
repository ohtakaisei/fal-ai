import { NextRequest, NextResponse } from "next/server";
import { requireFalKey } from "@/lib/fal-key";

export const dynamic = "force-dynamic";

// fal.ai アカウントの残クレジットを取得
// GET https://api.fal.ai/v1/account/billing?expand=credits （Adminスコープのキーが必要）
export async function GET(request: NextRequest) {
  const keyResult = requireFalKey(request);
  if ("error" in keyResult) {
    return NextResponse.json({ error: keyResult.error }, { status: keyResult.status });
  }

  try {
    const res = await fetch(
      "https://api.fal.ai/v1/account/billing?expand=credits",
      {
        headers: { Authorization: `Key ${keyResult.key}` },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      // 401/403 は Admin スコープでないキーの可能性が高い
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({
          needAdminKey: true,
          error:
            "残高の取得には Admin スコープの API キーが必要です（fal.ai ダッシュボード → Keys で Scope: Admin のキーを作成）",
        });
      }
      const err = await res.text();
      return NextResponse.json(
        { error: `fal.ai API error: ${res.status}`, details: err },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      username: data.username ?? null,
      balance: data.credits?.current_balance ?? null,
      currency: data.credits?.currency ?? "USD",
    });
  } catch (e) {
    console.error("Balance API error:", e);
    return NextResponse.json({ error: "残高の取得に失敗しました" }, { status: 500 });
  }
}
