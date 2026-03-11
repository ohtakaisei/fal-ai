import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getGeneratedDir(dirParam?: string | null): string {
  const dir = (dirParam || "generated").trim() || "generated";
  const resolved = path.resolve(process.cwd(), dir);
  if (!resolved.startsWith(process.cwd())) {
    throw new Error("不正なパスです");
  }
  return resolved;
}

export async function GET(request: NextRequest) {
  try {
    const dir = request.nextUrl.searchParams.get("dir");
    const generatedDir = getGeneratedDir(dir);

    if (!fs.existsSync(generatedDir)) {
      return NextResponse.json({ files: [] });
    }

    const entries = fs.readdirSync(generatedDir, { withFileTypes: true });
    const files: { name: string; path: string; type: string; size: number }[] = [];

    for (const ent of entries) {
      if (!ent.isFile()) continue;
      const fullPath = path.join(generatedDir, ent.name);
      const stat = fs.statSync(fullPath);
      const ext = path.extname(ent.name).toLowerCase();
      const type =
        [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)
          ? "image"
          : [".mp4", ".webm", ".mov"].includes(ext)
          ? "video"
          : [".mp3", ".wav", ".ogg"].includes(ext)
          ? "audio"
          : "file";

      const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, "/");
      files.push({
        name: ent.name,
        path: relPath,
        type,
        size: stat.size,
      });
    }

    // 新しい順（ファイル名にタイムスタンプが含まれる想定）
    files.sort((a, b) => (b.name < a.name ? -1 : 1));

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Generated list error:", error);
    return NextResponse.json({ error: "一覧の取得に失敗しました" }, { status: 500 });
  }
}
