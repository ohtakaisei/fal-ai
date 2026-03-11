import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  _request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const filePath = params.path?.join("/");
  if (!filePath) {
    return NextResponse.json({ error: "パスが必要です" }, { status: 400 });
  }

  // プロジェクトルートからの相対パスで解決、パストラバーサル対策
  const resolved = path.resolve(process.cwd(), filePath);
  if (!resolved.startsWith(process.cwd())) {
    return NextResponse.json({ error: "不正なパスです" }, { status: 400 });
  }

  try {
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 404 });
    }

    const buffer = fs.readFileSync(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const contentType: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mov": "video/quicktime",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".ogg": "audio/ogg",
      ".txt": "text/plain",
    };

    const headers = new Headers();
    const isDownload = _request.nextUrl.searchParams.get("download") === "1";
    if (isDownload) {
      headers.set(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(path.basename(resolved))}"`
      );
    }
    headers.set("Content-Type", contentType[ext] ?? "application/octet-stream");

    return new NextResponse(buffer, { headers });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json({ error: "ダウンロードに失敗しました" }, { status: 500 });
  }
}
