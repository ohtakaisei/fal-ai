"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";

interface HistoryItem {
  request_id: string;
  endpoint_id: string;
  started_at: string;
  sent_at: string;
  ended_at?: string | null;
  status_code?: number | null;
  duration?: number | null;
  json_input?: unknown;
  json_output?: unknown;
}

interface MediaRef {
  url: string;
  kind: "image" | "video" | "audio" | "other";
}

const PERIODS = [
  { value: "1", label: "24時間" },
  { value: "7", label: "7日間" },
  { value: "30", label: "30日間" },
  { value: "90", label: "90日間" },
];

// json_output から画像・動画・音声のURLを再帰的に抽出
function extractMedia(obj: unknown, acc: MediaRef[] = [], depth = 0): MediaRef[] {
  if (depth > 6 || !obj || acc.length >= 8) return acc;
  if (typeof obj === "string") {
    if (obj.startsWith("http")) {
      const lower = obj.split("?")[0].toLowerCase();
      const kind = /\.(png|jpe?g|webp|gif|avif)$/.test(lower)
        ? "image"
        : /\.(mp4|webm|mov)$/.test(lower)
        ? "video"
        : /\.(mp3|wav|ogg|m4a|flac)$/.test(lower)
        ? "audio"
        : null;
      if (kind && !acc.some((m) => m.url === obj)) acc.push({ url: obj, kind });
    }
    return acc;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) extractMedia(v, acc, depth + 1);
    return acc;
  }
  if (typeof obj === "object") {
    for (const v of Object.values(obj as Record<string, unknown>)) {
      extractMedia(v, acc, depth + 1);
    }
  }
  return acc;
}

function getPrompt(input: unknown): string | null {
  if (input && typeof input === "object") {
    const p = (input as Record<string, unknown>).prompt;
    if (typeof p === "string" && p.trim()) return p;
  }
  return null;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// このアプリで使用したモデル + モデル一覧キャッシュから endpoint_id を集める
async function collectEndpointIds(headers: Record<string, string>): Promise<string[]> {
  const ids = new Set<string>();
  try {
    const used = JSON.parse(localStorage.getItem("fal_used_endpoints") || "[]");
    if (Array.isArray(used)) used.forEach((id) => typeof id === "string" && ids.add(id));
  } catch {}
  try {
    const raw = sessionStorage.getItem("fal_models_cache");
    if (raw) {
      const { models } = JSON.parse(raw);
      if (Array.isArray(models)) {
        models.forEach((m: { endpoint_id?: string }) => m?.endpoint_id && ids.add(m.endpoint_id));
      }
    }
  } catch {}
  // キャッシュがない場合はモデル一覧を取得
  if (ids.size === 0) {
    try {
      const res = await fetch("/api/models?limit=100", { headers });
      const data = await res.json();
      (data.models || []).forEach(
        (m: { endpoint_id?: string }) => m?.endpoint_id && ids.add(m.endpoint_id)
      );
    } catch {}
  }
  return Array.from(ids);
}

const STATUS_STYLE = (code?: number | null) =>
  code != null && code >= 200 && code < 300
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : "bg-red-500/15 text-red-400 border-red-500/30";

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState("7");
  const [onlySuccess, setOnlySuccess] = useState(true);
  const [falKey, setFalKey] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setFalKey(localStorage.getItem("fal_api_key") || "");
    setMounted(true);
    const onKey = (e: Event) => setFalKey((e as CustomEvent<string>).detail || "");
    window.addEventListener("fal-key-changed", onKey);
    return () => window.removeEventListener("fal-key-changed", onKey);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const headers: Record<string, string> = falKey ? { "X-FAL-Key": falKey } : {};
    try {
      const ids = await collectEndpointIds(headers);
      if (ids.length === 0) {
        setItems([]);
        setError("モデル一覧を取得できませんでした。APIキーを確認してください。");
        return;
      }
      const start = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString();
      const params = new URLSearchParams({
        endpoint_ids: ids.join(","),
        start,
      });
      if (onlySuccess) params.set("status", "success");
      const res = await fetch(`/api/history?${params.toString()}`, { headers });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setItems(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "履歴の取得に失敗しました");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [falKey, days, onlySuccess]);

  useEffect(() => {
    if (!mounted) return;
    load();
  }, [mounted, load]);

  return (
    <main className="min-h-screen">
      <AppHeader />

      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-zinc-100">生成履歴</h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-500">
              fal.ai 上のリクエスト履歴（他ツールからの生成も含む）
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-white/5 p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setDays(p.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    days === p.value
                      ? "bg-violet-500 text-white"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={onlySuccess}
                onChange={(e) => setOnlySuccess(e.target.checked)}
                className="accent-violet-500"
              />
              成功のみ
            </label>
            <button
              type="button"
              onClick={load}
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/15"
            >
              更新
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                <div className="aspect-square animate-pulse bg-white/5" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-32 animate-pulse rounded bg-white/5" />
                  <div className="h-3 w-20 animate-pulse rounded bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-20 px-8 text-center">
            <p className="text-zinc-500">この期間の履歴はありません</p>
            <p className="mt-1 text-sm text-zinc-600">期間を長くするか、生成してみてください</p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-400"
            >
              生成ページへ
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-xs text-zinc-500">{items.length}件</p>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => {
                const media = extractMedia(item.json_output);
                const first = media[0];
                const prompt = getPrompt(item.json_input);
                const ok = item.status_code != null && item.status_code >= 200 && item.status_code < 300;
                return (
                  <div
                    key={item.request_id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition-all hover:border-white/20 hover:bg-white/[0.04]"
                  >
                    <div className="aspect-square flex items-center justify-center overflow-hidden bg-white/5">
                      {first?.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={first.url}
                          alt={prompt || item.endpoint_id}
                          loading="lazy"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : first?.kind === "video" ? (
                        <video src={first.url} controls preload="metadata" className="h-full w-full object-contain" />
                      ) : first?.kind === "audio" ? (
                        <div className="w-full p-4">
                          <audio src={first.url} controls className="w-full" />
                        </div>
                      ) : (
                        <div className="p-4 text-center text-xs text-zinc-600">
                          {ok ? "プレビューなし" : "エラー"}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium text-zinc-200" title={item.endpoint_id}>
                          {item.endpoint_id.replace(/^fal-ai\//, "")}
                        </p>
                        <span
                          className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLE(item.status_code)}`}
                        >
                          {ok ? "成功" : `エラー${item.status_code ? ` ${item.status_code}` : ""}`}
                        </span>
                      </div>
                      {prompt && (
                        <p className="line-clamp-2 text-xs text-zinc-500" title={prompt}>
                          {prompt}
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-between pt-1 text-[11px] text-zinc-600">
                        <span>{formatDate(item.ended_at || item.started_at)}</span>
                        {item.duration != null && <span>{item.duration.toFixed(1)}秒</span>}
                      </div>
                      {first && (
                        <a
                          href={`/api/proxy-download?url=${encodeURIComponent(first.url)}`}
                          download
                          className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/15"
                        >
                          ダウンロード
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-6 text-center text-xs text-zinc-600">
              ※ プレビューURLは一定期間で失効する場合があります。手元に残したいものは「ファイル」ページまたはダウンロードで保存してください。
            </p>
          </>
        )}
      </div>
    </main>
  );
}
