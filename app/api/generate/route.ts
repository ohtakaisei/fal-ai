import { NextRequest, NextResponse } from "next/server";
import { fal, ValidationError } from "@fal-ai/client";
import { requireFalKey } from "@/lib/fal-key";
import fs from "fs";
import path from "path";

function getGeneratedDir(saveDir?: string): string {
  const dir = (saveDir || "generated").trim() || "generated";
  const resolved = path.resolve(process.cwd(), dir);
  if (!resolved.startsWith(process.cwd())) {
    throw new Error("保存パスはプロジェクト内に指定してください");
  }
  return resolved;
}

function ensureGeneratedDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function downloadAndSaveFile(
  url: string,
  filename: string,
  targetDir: string
): Promise<string> {
  ensureGeneratedDir(targetDir);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download: ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const filePath = path.join(targetDir, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export async function POST(request: NextRequest) {
  const keyResult = requireFalKey(request);
  if ("error" in keyResult) {
    return NextResponse.json({ error: keyResult.error }, { status: keyResult.status });
  }
  const apiKey = keyResult.key;
  fal.config({ credentials: apiKey });

  try {
    const body = await request.json();
    const { endpointId, input, saveDir } = body;

    if (!endpointId || !input) {
      return NextResponse.json(
        { error: "endpointIdとinputは必須です" },
        { status: 400 }
      );
    }

    // 空のpromptやundefinedを除去（422の原因になりやすい）
    const cleanedInput: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v === undefined || v === null) continue;
      if (k === "prompt" && typeof v === "string" && !v.trim()) continue;
      cleanedInput[k] = v;
    }
    // モデルによって image_url / input_image / image_urls のいずれかを期待するため、エイリアスを設定
    const imgUrl = (cleanedInput.image_url ?? cleanedInput.input_image) as string | undefined;
    if (imgUrl && typeof imgUrl === "string") {
      if (!cleanedInput.input_image) cleanedInput.input_image = imgUrl;
      // nano-banana 等は image_urls（配列）を必須とする
      if (!cleanedInput.image_urls) cleanedInput.image_urls = [imgUrl];
    }

    // 画像・動画・音声生成の多くはprompt必須（画像編集でも変換内容の説明が必要）
    const hasImageInput =
      cleanedInput.image_url ||
      cleanedInput.image ||
      cleanedInput.input_image ||
      cleanedInput.control_image;
    if (!cleanedInput.prompt) {
      return NextResponse.json(
        {
          error: hasImageInput
            ? "プロンプトを入力してください（画像編集でも変換内容の説明が必要です）"
            : "プロンプト（入力テキスト）を入力してください",
        },
        { status: 400 }
      );
    }

    // fal.run: 同期的に実行（推奨）。fal.subscribe: キュー経由で実行
    const response = await fal.run(endpointId, { input: cleanedInput });
    const result = (response as { data?: unknown }).data ?? response;

    // 料金を取得
    let estimatedCost: number | null = null;
    try {
      const pricingRes = await fetch(
        `https://api.fal.ai/v1/models/pricing?endpoint_id=${encodeURIComponent(endpointId)}`,
        { headers: { Authorization: `Key ${apiKey}` } }
      );
      if (pricingRes.ok) {
        const pricingData = await pricingRes.json();
        const priceItem = pricingData.prices?.[0];
        if (priceItem?.unit_price != null) {
          const out = result as Record<string, unknown>;
          const outputCount = Array.isArray(out.images)
            ? out.images.length
            : out.image || out.video || out.audio
            ? 1
            : 1;
          estimatedCost = priceItem.unit_price * Math.max(1, outputCount);
        }
      }
    } catch {
      // 料金取得失敗は無視
    }

    const generatedDir = getGeneratedDir(saveDir);
    const savedFiles: string[] = [];
    const savedUrls = new Set<string>(); // 重複保存を防ぐ
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const baseName = `${endpointId.replace(/\//g, "_")}_${timestamp}`;

    const saveUrl = async (url: string, filename: string): Promise<boolean> => {
      if (savedUrls.has(url)) return false;
      try {
        const filePath = await downloadAndSaveFile(url, filename, generatedDir);
        savedFiles.push(path.relative(process.cwd(), filePath));
        savedUrls.add(url);
        return true;
      } catch (e) {
        console.error("Save error:", e);
        return false;
      }
    };

    // 結果からファイルURLを抽出して保存（未保存のURLのみ）
    const extractAndSaveUrls = async (
      obj: unknown,
      prefix: string
    ): Promise<void> => {
      if (!obj) return;

      if (typeof obj === "string" && obj.startsWith("http")) {
        const ext = obj.includes(".mp4") ? "mp4" : obj.includes(".wav") || obj.includes(".mp3") ? "mp3" : "png";
        await saveUrl(obj, `${prefix}_${savedFiles.length}.${ext}`);
        return;
      }

      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          await extractAndSaveUrls(obj[i], `${prefix}_${i}`);
        }
        return;
      }

      if (typeof obj === "object") {
        const entries = Object.entries(obj);
        for (const [key, value] of entries) {
          if (key === "url" && typeof value === "string" && value.startsWith("http")) {
            const ext = value.includes(".mp4")
              ? "mp4"
              : value.includes(".wav") || value.includes(".mp3")
              ? "mp3"
              : "png";
            await saveUrl(value, `${baseName}_${key}_${savedFiles.length}.${ext}`);
          } else {
            await extractAndSaveUrls(value, `${prefix}_${key}`);
          }
        }
      }
    };

    // 一般的な出力構造を処理
    const output = result as Record<string, unknown>;
    if (output.images) {
      for (let i = 0; i < (output.images as Array<{ url?: string }>).length; i++) {
        const img = (output.images as Array<{ url?: string }>)[i];
        if (img?.url) {
          await saveUrl(img.url, `${baseName}_image_${i}.png`);
        }
      }
    }
    const outputImage = output.image as { url?: string } | undefined;
    if (outputImage?.url) {
      await saveUrl(outputImage.url, `${baseName}_image.png`);
    }
    const outputVideo = output.video as { url?: string } | undefined;
    if (outputVideo?.url) {
      await saveUrl(outputVideo.url, `${baseName}_video.mp4`);
    }
    const outputAudio = output.audio as { url?: string } | undefined;
    if (outputAudio?.url) {
      const url = outputAudio.url;
      const ext = url.includes(".mp3") ? "mp3" : "wav";
      await saveUrl(url, `${baseName}_audio.${ext}`);
    }
    if (typeof output.text === "string") {
      ensureGeneratedDir(generatedDir);
      const filename = `${baseName}_text.txt`;
      const filePath = path.join(generatedDir, filename);
      fs.writeFileSync(filePath, output.text);
      savedFiles.push(path.relative(process.cwd(), filePath));
    }

    // 再帰的にURLを探す（未保存のURLのみ保存）
    await extractAndSaveUrls(output, baseName);

    const dirLabel = path.relative(process.cwd(), generatedDir).replace(/\\/g, "/") + "/";
    return NextResponse.json({
      success: true,
      result: output,
      savedFiles,
      generatedDir: dirLabel,
      estimatedCost: estimatedCost ?? undefined,
      currency: "USD",
    });
  } catch (error) {
    console.error("Generate error:", error);
    const err = error as { body?: { detail?: unknown }; status?: number };
    if (process.env.NODE_ENV === "development" && (err?.status === 422 || err?.status === 500)) {
      console.error(`${err?.status} detail:`, JSON.stringify(err?.body?.detail, null, 2));
    }
    const status = err?.status ?? 500;

    // 422/500: body.detail からメッセージを抽出
    let message = error instanceof Error ? error.message : "生成に失敗しました";
    if (error instanceof ValidationError || status === 422 || status === 500) {
      const detail = err?.body?.detail;
      const typeToMsg: Record<string, string> = {
        file_download_error: "画像のダウンロードに失敗しました。URLが有効か確認してください。",
        image_too_small: "画像が小さすぎます。512x512以上を推奨します。",
        image_too_large: "画像が大きすぎます。",
        image_load_error: "画像の読み込みに失敗しました。形式（PNG/JPEG等）を確認してください。",
        content_policy_violation: "コンテンツポリシーに抵触している可能性があります。別の画像・プロンプトをお試しください。",
        downstream_service_error:
          "AIモデル側で一時的なエラーが発生しました。しばらく待ってから再試行するか、別のモデルをお試しください。",
      };
      if (Array.isArray(detail) && detail.length > 0) {
        const parts = detail.map((d: { msg?: string; loc?: unknown[]; type?: string }) => {
          const field = Array.isArray(d.loc) && d.loc.length >= 2 ? d.loc[d.loc.length - 1] : null;
          const fieldName = typeof field === "string" ? field : null;
          if (d.type === "missing" && fieldName) {
            const names: Record<string, string> = {
              prompt: "プロンプト",
              image_url: "画像URL",
              image_urls: "画像URL",
              image: "画像",
              input_image: "入力画像",
            };
            return `${names[fieldName] ?? fieldName}は必須です`;
          }
          if (d.type && typeToMsg[d.type]) return typeToMsg[d.type];
          return d?.msg;
        }).filter(Boolean) as string[];
        if (parts.length > 0) message = parts.join(" ");
      } else if (typeof detail === "string") {
        message = detail;
      }
      if (status === 500 && message === (error instanceof Error ? error.message : "生成に失敗しました")) {
        message =
          "fal.ai のサーバーでエラーが発生しました。モデルが一時的に利用できない可能性があります。しばらく待ってから再試行するか、別のモデルをお試しください。";
      }
    }

    return NextResponse.json(
      {
        error: message,
        detail: process.env.NODE_ENV === "development" ? err?.body?.detail : undefined,
      },
      { status }
    );
  }
}
