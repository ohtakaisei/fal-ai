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
