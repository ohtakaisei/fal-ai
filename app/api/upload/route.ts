import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { requireFalKey } from "@/lib/fal-key";

export async function POST(request: NextRequest) {
  const keyResult = requireFalKey(request);
  if ("error" in keyResult) {
    return NextResponse.json({ error: keyResult.error }, { status: keyResult.status });
  }
  fal.config({ credentials: keyResult.key });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "ファイルを選択してください" },
        { status: 400 }
      );
    }
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|flac)$/i.test(file.name);
    const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov|avi)$/i.test(file.name);
    if (!isImage && !isAudio && !isVideo) {
      return NextResponse.json(
        { error: "画像・音声・動画ファイルを選択してください" },
        { status: 400 }
      );
    }

    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    const url = await fal.storage.upload(blob);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "アップロードに失敗しました" },
      { status: 500 }
    );
  }
}
