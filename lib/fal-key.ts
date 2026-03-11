import { NextRequest } from "next/server";

/**
 * リクエストから fal.ai API キーを取得
 * 1. X-FAL-Key ヘッダー（ユーザーがブラウザで設定したキー）
 * 2. process.env.FAL_KEY（デプロイ時に設定したキー）
 */
export function getFalKeyFromRequest(request: NextRequest): string | null {
  const headerKey = request.headers.get("x-fal-key")?.trim();
  if (headerKey) return headerKey;
  const envKey = process.env.FAL_KEY;
  if (envKey) return envKey;
  return null;
}

export function requireFalKey(request: NextRequest): { key: string } | { error: string; status: number } {
  const key = getFalKeyFromRequest(request);
  if (!key) {
    return {
      error: "fal.ai APIキーが設定されていません。画面上でキーを入力するか、.env.local に FAL_KEY を設定してください。",
      status: 401,
    };
  }
  return { key };
}
