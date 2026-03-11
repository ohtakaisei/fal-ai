"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABELS, needsAudioInput, needsVideoInput } from "@/lib/categories";

interface FalModel {
  endpoint_id: string;
  unit_price?: number;
  metadata: {
    display_name: string;
    category: string;
    description: string;
    status?: string;
    tags?: string[];
    thumbnail_url?: string;
  };
}

type SortOption = "default" | "quality" | "price_high" | "price_low" | "newest";

// カテゴリを大分類にグループ化（表示用）
const getCategoryType = (category: string): string => {
  if (!category) return "その他";
  const lower = category.toLowerCase();
  if (
    lower.includes("image") &&
    !lower.includes("video") &&
    !lower.includes("3d")
  )
    return "画像";
  if (lower.includes("video")) return "動画";
  if (
    lower.includes("speech") ||
    lower.includes("audio") ||
    lower.includes("tts")
  )
    return "音声";
  if (
    lower.includes("text") ||
    lower.includes("speech-to-text") ||
    lower.includes("generation")
  )
    return "文字";
  if (lower.includes("3d")) return "3D";
  if (lower.includes("training")) return "学習";
  return "その他";
};

// 画像アップロードが必要なモデルか
const needsImageInput = (category?: string): boolean =>
  (category || "").toLowerCase().includes("image-to");

const TYPE_COLORS: Record<string, string> = {
  画像: "bg-emerald-500/30 text-emerald-300 border-emerald-500/50",
  動画: "bg-violet-500/30 text-violet-300 border-violet-500/50",
  音声: "bg-amber-500/30 text-amber-300 border-amber-500/50",
  文字: "bg-blue-500/30 text-blue-300 border-blue-500/50",
  "3D": "bg-cyan-500/30 text-cyan-300 border-cyan-500/50",
  学習: "bg-rose-500/30 text-rose-300 border-rose-500/50",
  その他: "bg-slate-500/30 text-slate-300 border-slate-500/50",
};

export default function Home() {
  const [models, setModels] = useState<FalModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [selectedModel, setSelectedModel] = useState<FalModel | null>(null);
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoUrlsText, setVideoUrlsText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    url?: string;
    savedFiles?: string[];
    result?: unknown;
    error?: string;
    estimatedCost?: number;
  } | null>(null);
  const [modelPrice, setModelPrice] = useState<{ unit_price: number; unit: string } | null>(null);
  const [totalUsage, setTotalUsage] = useState<{ totalCost: number; currency: string } | null>(null);
  const [falKey, setFalKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setFalKey(localStorage.getItem("fal_api_key") || "");
    setMounted(true);
  }, []);

  const falHeaders = (): Record<string, string> =>
    falKey ? { "X-FAL-Key": falKey } : {};

  const saveFalKey = (key: string) => {
    setFalKey(key);
    if (typeof window !== "undefined") {
      localStorage.setItem("fal_api_key", key);
    }
    setShowKeyInput(false);
  };

  // モデル一覧: 段階的ロード（先に一覧表示→料金は後から）＋キャッシュ
  useEffect(() => {
    if (!mounted) return;
    const CACHE_KEY = "fal_models_cache";
    const CACHE_TTL_MS = 5 * 60 * 1000; // 5分

    const mergePricing = (modelsList: FalModel[], priceMap: Record<string, number>) =>
      modelsList.map((m) => ({ ...m, unit_price: priceMap[m.endpoint_id] }));

    const loadFromCache = (): FalModel[] | null => {
      if (typeof window === "undefined") return null;
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const { models: cached, ts } = JSON.parse(raw) as { models: FalModel[]; ts: number };
        if (Date.now() - ts > CACHE_TTL_MS || !Array.isArray(cached) || cached.length === 0) return null;
        return cached;
      } catch {
        return null;
      }
    };

    const saveToCache = (modelsList: FalModel[]) => {
      if (typeof window === "undefined") return;
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ models: modelsList, ts: Date.now() }));
      } catch {}
    };

    const cached = loadFromCache();
    const hasCache = !!(cached?.length);
    if (hasCache) {
      setModels(cached);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
    }

    const headers = falHeaders();
    fetch(`/api/models?limit=100`, { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        const modelsList = (data.models || []) as FalModel[];
        setError(null);
        if (modelsList.length > 0) saveToCache(modelsList);
        if (!hasCache) setLoading(false);

        if (modelsList.length === 0) {
          setModels([]);
          return;
        }

        if (!falKey) {
          setModels(modelsList);
          return;
        }

        if (!hasCache) setModels(modelsList);

        fetch("/api/pricing-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({
            endpoint_ids: modelsList.map((m) => m.endpoint_id),
          }),
        })
          .then((r) => r.json())
          .then((pData) => {
            const priceMap = (pData?.priceMap || {}) as Record<string, number>;
            if (Object.keys(priceMap).length > 0) {
              setModels((prev) => mergePricing(prev, priceMap));
              saveToCache(mergePricing(modelsList, priceMap));
            }
          })
          .catch(() => {});
      })
      .catch((e) => {
        setError(e.message);
        if (!hasCache) setLoading(false);
      });
  }, [falKey, mounted]);

  // 累計使用量を取得（生成後に再取得）
  useEffect(() => {
    if (!falKey) return;
    fetch("/api/usage", { headers: falHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (!data.error && data.totalCost != null) {
          setTotalUsage({ totalCost: data.totalCost, currency: data.currency || "USD" });
        }
      })
      .catch(() => {});
  }, [result, falKey]);

  // 名前を付けて保存（保存先をユーザーが選択）
  const handleSaveAs = async (url: string) => {
    const ext = url.includes(".mp4") ? "mp4" : url.includes(".mp3") || url.includes(".wav") ? "mp3" : "png";
    const suggestedName = `fal-generated-${Date.now()}.${ext}`;
    const accept = ext === "mp4"
      ? { "video/mp4": [".mp4"] }
      : ext === "mp3"
      ? { "audio/mpeg": [".mp3"] }
      : { "image/png": [".png"], "image/jpeg": [".jpg"], "image/webp": [".webp"] };

    try {
      const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error("取得に失敗しました");
      const blob = await res.blob();

      if ("showSaveFilePicker" in window) {
        const handle = await (window as Window & { showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle> })
          .showSaveFilePicker({ suggestedName, types: [{ description: "", accept }] });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = suggestedName;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      alert((e as Error).message || "保存に失敗しました");
    }
  };

  // 選択したモデルの料金（models-with-pricing で取得済みの場合はAPI呼び出し不要）
  useEffect(() => {
    if (!selectedModel) {
      setModelPrice(null);
      return;
    }
    if (selectedModel.unit_price != null) {
      setModelPrice({ unit_price: selectedModel.unit_price, unit: "回" });
      return;
    }
    setModelPrice(null);
    fetch(`/api/pricing?endpoint_id=${encodeURIComponent(selectedModel.endpoint_id)}`, {
      headers: falHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        const p = data.prices?.[0];
        if (p?.unit_price != null) {
          setModelPrice({ unit_price: p.unit_price, unit: p.unit || "回" });
        }
      })
      .catch(() => {});
  }, [selectedModel]);

  const filteredModels = models.filter((m) => {
    const type = getCategoryType(m.metadata?.category || "");
    const matchFilter =
      filter === "all" || type === filter;

    const matchSearch =
      !search ||
      (m.metadata?.display_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.endpoint_id || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.metadata?.description || "").toLowerCase().includes(search.toLowerCase());

    return matchFilter && matchSearch && m.metadata?.status !== "deprecated";
  });

  const sortedModels = [...filteredModels].sort((a, b) => {
    if (sortBy === "quality" || sortBy === "price_high") {
      const pa = a.unit_price ?? -1;
      const pb = b.unit_price ?? -1;
      return pb - pa;
    }
    if (sortBy === "price_low") {
      const pa = a.unit_price ?? Infinity;
      const pb = b.unit_price ?? Infinity;
      return pa - pb;
    }
    if (sortBy === "newest") {
      return (b.endpoint_id || "").localeCompare(a.endpoint_id || "");
    }
    return 0;
  });

  const categoryTypes = Array.from(
    new Set(models.map((m) => getCategoryType(m.metadata?.category || "")))
  ).sort();

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImageUrl("");
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setImageFile(null);
      setImagePreview(null);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl("");
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setAudioUrl("");
    } else {
      setAudioFile(null);
    }
  };

  const handleGenerate = async () => {
    if (!selectedModel) return;
    setGenerating(true);
    setResult(null);

    let finalImageUrl = imageUrl;

    if (imageFile && needsImage) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", imageFile);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          headers: falHeaders(),
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || "アップロードに失敗しました");
        finalImageUrl = uploadData.url;
      } catch (e) {
        setResult({ error: e instanceof Error ? e.message : "画像のアップロードに失敗しました" });
        setGenerating(false);
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    }

    let finalAudioUrl = audioUrl;
    if (audioFile && needsAudio) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", audioFile);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          headers: falHeaders(),
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || "アップロードに失敗しました");
        finalAudioUrl = uploadData.url;
      } catch (e) {
        setResult({ error: e instanceof Error ? e.message : "音声のアップロードに失敗しました" });
        setGenerating(false);
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    }

    const input: Record<string, unknown> = { prompt };
    if (finalImageUrl) input.image_url = finalImageUrl;
    if (finalAudioUrl) input.audio_url = finalAudioUrl;
    const videoUrls = videoUrlsText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (videoUrls.length > 0 && needsVideo) input.video_urls = videoUrls;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...falHeaders() },
        body: JSON.stringify({
          endpointId: selectedModel.endpoint_id,
          input,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成に失敗しました");

      setResult({
        url: data.result?.images?.[0]?.url ?? data.result?.image?.url ?? data.result?.video?.url ?? data.result?.audio?.url,
        savedFiles: data.savedFiles,
        result: data.result,
        estimatedCost: data.estimatedCost,
      });
    } catch (e) {
      setResult({
        error: e instanceof Error ? e.message : "エラーが発生しました",
      });
    } finally {
      setGenerating(false);
    }
  };

  const needsImage = needsImageInput(selectedModel?.metadata?.category);
  const needsAudio = needsAudioInput(selectedModel?.metadata?.category, selectedModel?.endpoint_id);
  const needsVideo = needsVideoInput(selectedModel?.metadata?.category, selectedModel?.endpoint_id);

  const hasRequiredAudio = !needsAudio || !!audioUrl || !!audioFile;
  const hasRequiredVideo = !needsVideo || videoUrlsText.trim().split(/[\n,]+/).some((s) => s.trim().length > 0);
  const hasRequiredImage = !needsImage || !!imageUrl || !!imageFile;
  const canGenerate = hasRequiredAudio && hasRequiredVideo && hasRequiredImage;

  return (
    <main className="min-h-screen">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0c0c0f]/95 backdrop-blur-md safe-area-inset-top">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 min-h-[3.5rem] items-center justify-between gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight shrink-0 min-w-0">
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent truncate block">
                fal.ai モデルエクスプローラー
              </span>
            </h1>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {mounted && falKey ? (
                <button
                  type="button"
                  onClick={() => setShowKeyInput(true)}
                  className="rounded-full bg-white/5 px-3 py-2 sm:px-4 text-xs sm:text-sm text-zinc-400 hover:bg-white/10 hover:text-zinc-200 min-h-[2.5rem]"
                  title="APIキーを変更"
                >
                  <span className="hidden sm:inline">🔑 キー設定済み</span>
                  <span className="sm:hidden">🔑</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowKeyInput(true)}
                  className="rounded-full bg-amber-500/20 px-3 py-2 sm:px-4 text-xs sm:text-sm font-medium text-amber-400 hover:bg-amber-500/30 min-h-[2.5rem] whitespace-nowrap"
                >
                  <span className="hidden sm:inline">fal.ai APIキーを設定</span>
                  <span className="sm:hidden">APIキー</span>
                </button>
              )}
              {totalUsage != null && (
                <div className="hidden sm:flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-xs sm:text-sm">
                  <span className="text-zinc-500">累計</span>
                  <span className="font-medium text-amber-400">
                    ${totalUsage.totalCost.toFixed(4)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* APIキー入力モーダル */}
      {showKeyInput && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
          <div className="mx-0 sm:mx-4 w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0c0c0f] p-4 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto safe-area-inset-bottom">
            <h3 className="mb-4 text-lg font-semibold text-zinc-200">
              fal.ai APIキー
            </h3>
            <p className="mb-4 text-sm text-zinc-400">
              <a
                href="https://fal.ai/dashboard/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:underline"
              >
                fal.ai ダッシュボード
              </a>
              でキーを取得し、入力してください。キーはブラウザに保存され、fal.ai API呼び出し時にのみ使用されます。
            </p>
            <input
              type="password"
              placeholder="fal-xxxxxxxx..."
              value={falKey}
              onChange={(e) => setFalKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveFalKey(falKey)}
              className="mb-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:border-violet-500/50 focus:outline-none"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => saveFalKey(falKey)}
                className="flex-1 rounded-xl bg-violet-500 py-3 font-medium text-white hover:bg-violet-400"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => setShowKeyInput(false)}
                className="rounded-xl bg-white/10 py-3 px-4 text-zinc-300 hover:bg-white/15"
              >
                キャンセル
              </button>
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              デプロイ時に FAL_KEY を環境変数で設定している場合は、入力不要です。
            </p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-4 sm:py-8 min-w-0 overflow-x-hidden">
        <p className="mb-4 sm:mb-8 text-center text-xs sm:text-sm text-zinc-500 px-2">
          fal.aiの全AIモデルを自由に選択して画像・動画・音声・文字を生成
        </p>
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* 検索・フィルター */}
        <div className="mb-4 sm:mb-8 space-y-3 sm:space-y-4">
          <div className="relative w-full max-w-xl">
            <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="モデル名で検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-zinc-100 placeholder-zinc-500 transition-colors focus:border-violet-500/50 focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-full px-3 py-2 sm:px-4 text-xs sm:text-sm font-medium transition-all min-h-[2.5rem] ${
                filter === "all"
                  ? "bg-violet-500 text-white shadow-lg shadow-violet-500/25"
                  : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
              }`}
            >
              すべて
            </button>
            {categoryTypes.map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`rounded-full px-3 py-2 sm:px-4 text-xs sm:text-sm font-medium transition-all min-h-[2.5rem] ${
                  filter === t ? TYPE_COLORS[t] + " ring-1 ring-white/10" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:gap-8 lg:grid-cols-[minmax(0,380px)_1fr] min-w-0">
          {/* モデル一覧 */}
            <div className="lg:sticky lg:top-24 lg:self-start order-2 lg:order-1 min-w-0 overflow-hidden">
            <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4 overflow-hidden">
              <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
                モデル一覧
              </h2>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-zinc-500">{sortedModels.length}件</p>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 sm:px-3 py-2 text-xs text-zinc-300 focus:border-violet-500/50 focus:outline-none min-h-[2.25rem] max-w-full"
                >
                  <option value="default">並び替え</option>
                  <option value="quality">精度が高い順</option>
                  <option value="price_high">値段が高い順</option>
                  <option value="price_low">値段が安い順</option>
                  <option value="newest">新しい順</option>
                </select>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
                  ))}
                </div>
              ) : (
                <div className="max-h-[280px] sm:max-h-[calc(100vh-320px)] space-y-2 overflow-y-auto overflow-x-hidden pr-1 -mr-1">
                  {sortedModels.map((m) => (
                    <button
                      key={m.endpoint_id}
                      onClick={() => {
                        setSelectedModel(m);
                        setResult(null);
                        setAudioFile(null);
                        setAudioUrl("");
                        setVideoUrlsText("");
                      }}
                      className={`w-full min-w-0 text-left rounded-xl p-3 transition-all overflow-hidden ${
                        selectedModel?.endpoint_id === m.endpoint_id
                          ? "bg-violet-500/20 ring-1 ring-violet-500/40"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                        <span
                          className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                            TYPE_COLORS[getCategoryType(m.metadata?.category || "")] ||
                            TYPE_COLORS["その他"]
                          }`}
                        >
                          {getCategoryType(m.metadata?.category || "")}
                        </span>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="truncate font-medium text-zinc-200 text-sm sm:text-base" title={m.metadata?.display_name || m.endpoint_id}>
                            {m.metadata?.display_name || m.endpoint_id}
                            {needsImageInput(m.metadata?.category) && (
                              <span className="text-amber-400"> (画像参照)</span>
                            )}
                            {needsAudioInput(m.metadata?.category, m.endpoint_id) && (
                              <span className="text-violet-400"> (音声参照)</span>
                            )}
                            {needsVideoInput(m.metadata?.category, m.endpoint_id) && (
                              <span className="text-cyan-400"> (動画参照)</span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 min-w-0">
                            <span className="truncate text-xs text-zinc-500" title={m.endpoint_id}>
                              {m.endpoint_id}
                            </span>
                            {m.unit_price != null && (
                              <span className="shrink-0 text-xs text-amber-400">
                                ${m.unit_price.toFixed(4)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 生成パネル */}
          <div className="min-w-0 order-1 lg:order-2">
            {selectedModel ? (
              <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6 lg:p-8">
                <div className="space-y-6">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2 min-w-0">
                      <span
                        className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium ${
                          TYPE_COLORS[getCategoryType(selectedModel.metadata?.category || "")] ||
                          TYPE_COLORS["その他"]
                        }`}
                      >
                        {getCategoryType(selectedModel.metadata?.category || "")}
                      </span>
                      {needsImageInput(selectedModel.metadata?.category) && (
                        <span className="shrink-0 rounded-md bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-400">
                          画像参照
                        </span>
                      )}
                      {needsAudio && (
                        <span className="shrink-0 rounded-md bg-violet-500/20 px-2.5 py-1 text-xs font-medium text-violet-400">
                          音声参照
                        </span>
                      )}
                      {needsVideo && (
                        <span className="shrink-0 rounded-md bg-cyan-500/20 px-2.5 py-1 text-xs font-medium text-cyan-400">
                          動画参照
                        </span>
                      )}
                      <span className="text-sm text-zinc-500 truncate min-w-0">
                        {CATEGORY_LABELS[selectedModel.metadata?.category || ""] ||
                          selectedModel.metadata?.category}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-zinc-400 break-words min-w-0">
                      {selectedModel.metadata?.description}
                    </p>
                    {modelPrice && (
                      <p className="mt-3 text-sm font-medium text-amber-400">
                        約 ${modelPrice.unit_price.toFixed(4)} / {modelPrice.unit}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">
                      プロンプト
                    </label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="生成したい内容を入力..."
                      rows={4}
                      className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-100 placeholder-zinc-500 transition-colors focus:border-violet-500/50 focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>

                  {needsImage && (
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-zinc-300">
                        画像（アップロードまたはURL）
                      </label>
                      <div className="flex gap-2">
                        <label className="flex-1 cursor-pointer">
                          <span className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300 transition-colors hover:bg-white/10">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                            </svg>
                            画像を選択
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageFileChange}
                            className="hidden"
                          />
                        </label>
                        {(imageFile || imageUrl) && (
                          <button
                            type="button"
                            onClick={clearImage}
                            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 transition-colors hover:bg-red-500/20"
                          >
                            クリア
                          </button>
                        )}
                      </div>
                      {imagePreview && (
                        <div className="overflow-hidden rounded-xl border border-white/10">
                          <img
                            src={imagePreview}
                            alt="プレビュー"
                            className="max-h-48 w-full object-contain"
                          />
                        </div>
                      )}
                      <div className="relative">
                        <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-zinc-500">または</span>
                        <input
                          type="url"
                          value={imageUrl}
                          onChange={(e) => {
                            setImageUrl(e.target.value);
                            if (e.target.value) {
                              setImageFile(null);
                              setImagePreview(null);
                            }
                          }}
                          placeholder="画像URL (https://...)"
                          className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-12 sm:pl-14 pr-4 text-sm sm:text-base text-zinc-100 placeholder-zinc-500 focus:border-violet-500/50 focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                        />
                      </div>
                    </div>
                  )}

                  {needsAudio && (
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-zinc-300">
                        音声（アップロードまたはURL）
                      </label>
                      <div className="flex gap-2">
                        <label className="flex-1 cursor-pointer">
                          <span className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300 transition-colors hover:bg-white/10">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0V8m0 7V4" />
                            </svg>
                            音声を選択
                          </span>
                          <input
                            type="file"
                            accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
                            onChange={handleAudioFileChange}
                            className="hidden"
                          />
                        </label>
                        {(audioFile || audioUrl) && (
                          <button
                            type="button"
                            onClick={() => {
                              setAudioFile(null);
                              setAudioUrl("");
                            }}
                            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 transition-colors hover:bg-red-500/20"
                          >
                            クリア
                          </button>
                        )}
                      </div>
                      {audioFile && (
                        <p className="text-sm text-zinc-400">選択中: {audioFile.name}</p>
                      )}
                      <div className="relative">
                        <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-zinc-500">または</span>
                        <input
                          type="url"
                          value={audioUrl}
                          onChange={(e) => {
                            setAudioUrl(e.target.value);
                            if (e.target.value) setAudioFile(null);
                          }}
                          placeholder="音声URL (https://...)"
                          className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-12 sm:pl-14 pr-4 text-sm sm:text-base text-zinc-100 placeholder-zinc-500 focus:border-violet-500/50 focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                        />
                      </div>
                    </div>
                  )}

                  {needsVideo && (
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-zinc-300">
                        動画URL（複数可・カンマまたは改行で区切る）
                      </label>
                      <textarea
                        value={videoUrlsText}
                        onChange={(e) => setVideoUrlsText(e.target.value)}
                        placeholder="https://example.com/video1.mp4, https://example.com/video2.mp4"
                        rows={3}
                        className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-100 placeholder-zinc-500 transition-colors focus:border-violet-500/50 focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                      />
                    </div>
                  )}

                  {!canGenerate && (needsAudio || needsVideo || needsImage) && (
                    <p className="text-sm text-amber-400">
                      {[
                        !hasRequiredAudio && needsAudio && "音声をアップロードするかURLを入力してください",
                        !hasRequiredVideo && needsVideo && "動画URLを入力してください",
                        !hasRequiredImage && needsImage && "画像をアップロードするかURLを入力してください",
                      ]
                        .filter(Boolean)
                        .join(" / ")}
                    </p>
                  )}
                  <button
                    onClick={handleGenerate}
                    disabled={generating || uploading || !canGenerate}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 py-4 font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none min-h-[3rem] touch-manipulation"
                  >
                    {uploading ? (
                      <>
                        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        アップロード中...
                      </>
                    ) : generating ? (
                      <>
                        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        生成中...
                      </>
                    ) : (
                      <>
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        生成する
                      </>
                    )}
                  </button>

                  {result?.error && (
                    <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                      <svg className="mt-0.5 h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {result.error}
                    </div>
                  )}
                {result && !result.error && (
                  <div className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="font-medium">生成完了！「名前を付けて保存」で保存先を選択できます</span>
                    </div>
                    {result.estimatedCost != null && (
                      <p className="text-sm text-amber-400">
                        今回の推定料金: 約 ${result.estimatedCost.toFixed(4)} USD
                      </p>
                    )}
                    {result.url && (
                      <div className="space-y-3">
                        <div className="overflow-hidden rounded-xl border border-white/10">
                          {result.url.includes(".mp4") ? (
                            <video src={result.url} controls className="w-full" />
                          ) : result.url.includes(".mp3") || result.url.includes(".wav") ? (
                            <div className="bg-white/5 p-4">
                              <audio src={result.url} controls className="w-full" />
                            </div>
                          ) : (
                            <img src={result.url} alt="生成結果" className="w-full" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => { if (result.url) handleSaveAs(result.url); }}
                          className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-500/25 transition-colors hover:bg-violet-400"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          名前を付けて保存
                        </button>
                      </div>
                    )}
                    {mounted && typeof window !== "undefined" && window.location.hostname === "localhost" && (
                      <a
                        href="/generated"
                        className="inline-flex items-center gap-2 text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
                      >
                        生成ファイル一覧を見る（ローカルのみ）
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </a>
                    )}
                  </div>
                )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-16 px-8 text-center">
                <div className="mb-4 rounded-full bg-white/5 p-4">
                  <svg className="h-10 w-10 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-zinc-500">下のリストからモデルを選択してください</p>
                <p className="mt-1 text-sm text-zinc-600">画像・動画・音声・文字を生成できます</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="border-t border-white/5 py-4 sm:py-8">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <p className="text-center text-xs sm:text-sm text-zinc-500 px-2 leading-relaxed">
            画面上でAPIキーを設定するか、.env.local に FAL_KEY を設定してください。{" "}
            <a
              href="https://fal.ai/dashboard/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300"
            >
              fal.ai でキーを取得
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
