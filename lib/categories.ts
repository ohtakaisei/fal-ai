// 音声入力（audio_url）が必要なモデルか
export const needsAudioInput = (category?: string, endpointId?: string): boolean => {
  const c = (category || "").toLowerCase();
  const e = (endpointId || "").toLowerCase();
  return c.includes("speech-to-text") || c.includes("audio-to") || e.includes("whisper");
};

// 動画入力（video_urls）が必要なモデルか
export const needsVideoInput = (category?: string, endpointId?: string): boolean => {
  const c = (category || "").toLowerCase();
  const e = (endpointId || "").toLowerCase();
  return c.includes("video-to-video") || e.includes("ffmpeg") || e.includes("merge-videos");
};

// カテゴリを日本語の生成タイプにマッピング
export const CATEGORY_LABELS: Record<string, string> = {
  "text-to-image": "画像生成",
  "image-to-image": "画像編集",
  "image-to-video": "動画生成（画像→動画）",
  "text-to-video": "動画生成（テキスト→動画）",
  "video-to-video": "動画編集",
  "text-to-speech": "音声生成",
  "text-to-audio": "音声/音楽生成",
  "audio-to-audio": "音声変換",
  "audio-to-video": "音声→動画",
  "speech-to-text": "文字生成（音声認識）",
  "text-generation": "文字生成",
  "image-to-3d": "3D生成",
  training: "モデル学習",
  vision: "画像解析",
  default: "その他",
};
