import { NextRequest, NextResponse } from "next/server";

/**
 * fal.ai のURLをプロキシしてダウンロード用に返す（CORS回避）
 * url パラメータは fal.media ドメインのみ許可
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url が必要です" }, { status: 400 });
  }
  try {
    const parsed = new URL(url);
    const allowedHosts = ["fal.media", "v3b.fal.media", "fal.ai"];
    const isAllowed = allowedHosts.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
    if (!isAllowed) {
      return NextResponse.json({ error: "許可されていないURLです" }, { status: 400 });
    }
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: "ファイルの取得に失敗しました" }, { status: 502 });
    }
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const contentDisposition = res.headers.get("content-disposition");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        ...(contentDisposition && { "Content-Disposition": contentDisposition }),
      },
    });
  } catch (e) {
    console.error("Proxy download error:", e);
    return NextResponse.json({ error: "ダウンロードに失敗しました" }, { status: 500 });
  }
}
