// モデル入力スキーマ（OpenAPIから抽出・平坦化したもの）

export interface SchemaField {
  name: string;
  title?: string;
  type: "string" | "integer" | "number" | "boolean" | "enum";
  enum?: (string | number)[];
  default?: string | number | boolean;
  minimum?: number;
  maximum?: number;
  description?: string;
  required: boolean;
}

// 専用UIで扱うため動的フォームから除外するキー
export const HANDLED_KEYS = new Set([
  "prompt",
  "image_url",
  "image_urls",
  "input_image",
  "audio_url",
  "video_url",
  "video_urls",
  "sync_mode", // レスポンス形式が変わり保存処理が壊れるため非表示
]);

// fal の image_size プリセット → メガピクセル換算
const IMAGE_SIZE_MP: Record<string, number> = {
  square_hd: (1024 * 1024) / 1e6,
  square: (512 * 512) / 1e6,
  portrait_4_3: (768 * 1024) / 1e6,
  portrait_16_9: (576 * 1024) / 1e6,
  landscape_4_3: (1024 * 768) / 1e6,
  landscape_16_9: (1024 * 576) / 1e6,
};

/**
 * 設定値から課金単位数を概算する。
 * - 枚数系: num_images / num_outputs / num_videos
 * - 秒課金 (unit に second を含む): duration 系の値を掛ける
 * - メガピクセル課金: image_size / width / height から換算
 */
export function computeBillingUnits(
  unit: string | undefined,
  values: Record<string, unknown>,
  defaultDuration?: number | null
): { units: number; note: string | null } {
  const u = (unit || "").toLowerCase();
  const count =
    toNum(values.num_images) ?? toNum(values.num_outputs) ?? toNum(values.num_videos) ?? 1;
  let units = Math.max(1, count);
  let note: string | null = count > 1 ? `${count}枚` : null;

  const dur =
    toNum(values.duration) ??
    toNum(values.video_duration) ??
    toNum(values.duration_seconds) ??
    toNum(values.num_seconds);

  if (u.includes("second")) {
    if (dur && dur > 0) {
      units = Math.max(1, count) * dur;
      note = `${dur}秒${count > 1 ? ` × ${count}本` : ""}`;
    }
  } else if (u.includes("video") && dur && dur > 0 && defaultDuration && defaultDuration > 0) {
    // per-video 課金でも長さに比例して課金されるモデルが多いため、
    // デフォルト長を1単位として比例換算する（概算）
    if (dur !== defaultDuration) {
      units = (Math.max(1, count) * dur) / defaultDuration;
      note = `${dur}秒（基準 ${defaultDuration}秒）${count > 1 ? ` × ${count}本` : ""}`;
    }
  } else if (u.includes("megapixel")) {
    let mp: number | null = null;
    const size = values.image_size;
    if (typeof size === "string" && IMAGE_SIZE_MP[size] != null) {
      mp = IMAGE_SIZE_MP[size];
    } else {
      const w = toNum(values.width);
      const h = toNum(values.height);
      if (w && h) mp = (w * h) / 1e6;
    }
    if (mp && mp > 0) {
      units = Math.max(1, count) * mp;
      note = `${mp.toFixed(2)}MP${count > 1 ? ` × ${count}枚` : ""}`;
    }
  }

  return { units, note };
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}
