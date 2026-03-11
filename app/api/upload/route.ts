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
    if (!file || !file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "画像ファイルを選択してください" },
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
