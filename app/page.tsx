"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/categories";

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
  const [saveDir, setSaveDir] = useState(() => {
    if (typeof window === "undefined") return "generated";
    return localStorage.getItem("fal_save_dir") || "generated";
  });
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

  useEffect(() => {
    setLoading(true);
    fetch("/api/models-with-pricing?limit=100", { headers: falHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setModels(data.models || []);
      })
      .catch(() =>
        fetch("/api/models?limit=100", { headers: falHeaders() })
          .then((res) => res.json())
          .then((data) => {
            if (data.error) throw new Error(data.error);
            setModels(data.models || []);
          })
      )
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [falKey]);

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

  // 保存フォルダを localStorage に永続化
  useEffect(() => {
    if (typeof window !== "undefined" && saveDir) {
      localStorage.setItem("fal_save_dir", saveDir);
    }
  }, [saveDir]);

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

    const input: Record<string, unknown> = { prompt };
    if (finalImageUrl) input.image_url = finalImageUrl;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...falHeaders() },
        body: JSON.stringify({
          endpointId: selectedModel.endpoint_id,
          input,
          saveDir: saveDir || undefined,
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

  const needsImage = selectedModel?.metadata?.category?.includes("image-to") ?? false;

  return (
    <main className="min-h-screen">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0c0c0f]/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <h1 className="text-lg font-semibold tracking-tight">
                <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
                  fal.ai モデルエクスプローラー
                </span>
              </h1>
              <nav className="hidden sm:flex items-center gap-1">
                <a
                  href="/generated"
                  className="rounded-md px-3 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors"
                >
                  生成ファイル一覧
                </a>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              {mounted && falKey ? (
                <button
                  type="button"
                  onClick={() => setShowKeyInput(true)}
                  className="rounded-full bg-white/5 px-4 py-2 text-sm text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                  title="APIキーを変更"
                >
                  🔑 キー設定済み
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowKeyInput(true)}
                  className="rounded-full bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/30"
                >
                  fal.ai APIキーを設定
                </button>
              )}
              {totalUsage != null && (
                <div className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm">
                  <span className="text-zinc-500">累計</span>
                  <span className="font-medium text-amber-400">
                    ${totalUsage.totalCost.toFixed(4)}
                  </span>
                  <span className="text-zinc-500">{totalUsage.currency}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* APIキー入力モーダル */}
      {showKeyInput && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c0f] p-6 shadow-xl">
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

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <p className="mb-8 text-center text-sm text-zinc-500">
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
        <div className="mb-8 space-y-4">
          <div className="relative max-w-xl">
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
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
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
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  filter === t ? TYPE_COLORS[t] + " ring-1 ring-white/10" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
          {/* モデル一覧 */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
                モデル一覧
              </h2>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-zinc-500">{sortedModels.length}件</p>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 focus:border-violet-500/50 focus:outline-none"
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
                <div className="max-h-[calc(100vh-320px)] space-y-2 overflow-y-auto pr-1">
                  {sortedModels.map((m) => (
                    <button
                      key={m.endpoint_id}
                      onClick={() => {
                        setSelectedModel(m);
                        setResult(null);
                      }}
                      className={`w-full text-left rounded-xl p-3 transition-all ${
                        selectedModel?.endpoint_id === m.endpoint_id
                          ? "bg-violet-500/20 ring-1 ring-violet-500/40"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                            TYPE_COLORS[getCategoryType(m.metadata?.category || "")] ||
                            TYPE_COLORS["その他"]
                          }`}
                        >
                          {getCategoryType(m.metadata?.category || "")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-zinc-200">
                            {m.metadata?.display_name || m.endpoint_id}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="truncate text-xs text-zinc-500">
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
          <div className="min-w-0">
            {selectedModel ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
                <div className="space-y-6">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                          TYPE_COLORS[getCategoryType(selectedModel.metadata?.category || "")] ||
                          TYPE_COLORS["その他"]
                        }`}
                      >
                        {getCategoryType(selectedModel.metadata?.category || "")}
                      </span>
                      <span className="text-sm text-zinc-500">
                        {CATEGORY_LABELS[selectedModel.metadata?.category || ""] ||
                          selectedModel.metadata?.category}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-zinc-400">
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
                      保存フォルダ
                    </label>
                    <input
                      type="text"
                      value={saveDir}
                      onChange={(e) => setSaveDir(e.target.value)}
                      placeholder="generated（プロジェクト内の相対パス）"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 transition-colors focus:border-violet-500/50 focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                    <p className="mt-1 text-xs text-zinc-500">
                      プロジェクトルートからの相対パス（例: generated, output/images）
                    </p>
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
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">または</span>
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
                          placeholder="画像URLを入力 (https://...)"
                          className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-14 pr-4 text-zinc-100 placeholder-zinc-500 transition-colors focus:border-violet-500/50 focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleGenerate}
                    disabled={generating || uploading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 py-4 font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
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
                      <span className="font-medium">生成完了！{saveDir || "generated"}/ フォルダに保存されました</span>
                    </div>
                    {result.estimatedCost != null && (
                      <p className="text-sm text-amber-400">
                        今回の推定料金: 約 ${result.estimatedCost.toFixed(4)} USD
                      </p>
                    )}
                    {result.savedFiles?.length ? (
                      <ul className="space-y-1 text-xs text-zinc-500">
                        {result.savedFiles.map((f) => (
                          <li key={f} className="truncate">{f}</li>
                        ))}
                      </ul>
                    ) : null}
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
                        {result.savedFiles?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {result.savedFiles.map((f) => {
                              const apiPath = f.split("/").map(encodeURIComponent).join("/");
                              return (
                                <a
                                  key={f}
                                  href={`/api/generated/${apiPath}?download=1`}
                                  download={f.split("/").pop()}
                                  title={f.split("/").pop()}
                                  className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/15"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                  ダウンロード
                                </a>
                              );
                            })}
                          </div>
                        ) : (
                          <a
                            href={result.url}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/15"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            ダウンロード
                          </a>
                        )}
                      </div>
                    )}
                    <a
                      href="/generated"
                      className="inline-flex items-center gap-2 text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
                    >
                      生成ファイル一覧を見る
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </a>
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
                <p className="text-zinc-500">左のリストからモデルを選択してください</p>
                <p className="mt-1 text-sm text-zinc-600">画像・動画・音声・文字を生成できます</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-zinc-500">
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
