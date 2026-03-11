"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface GeneratedFile {
  name: string;
  path: string;
  type: "image" | "video" | "audio" | "file";
  size: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSaveDir(): string {
  if (typeof window === "undefined") return "generated";
  return localStorage.getItem("fal_save_dir") || "generated";
}

export default function GeneratedPage() {
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveDir, setSaveDir] = useState("generated");

  const loadFiles = (dir: string) => {
    setLoading(true);
    fetch(`/api/generated?dir=${encodeURIComponent(dir)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setFiles(data.files || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const dir = getSaveDir();
    setSaveDir(dir);
    loadFiles(dir);
  }, []);

  const toApiPath = (p: string) =>
    p.split("/").map(encodeURIComponent).join("/");
  const downloadUrl = (p: string) => `/api/generated/${toApiPath(p)}?download=1`;
  const previewUrl = (p: string) => `/api/generated/${toApiPath(p)}`;

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0c0c0f]/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-4 sm:py-0 sm:h-16">
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold tracking-tight truncate">
                <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
                  生成ファイル一覧
                </span>
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-zinc-500 truncate">
                {saveDir}/ フォルダ
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0 sm:flex-initial">
                <input
                  type="text"
                  value={saveDir}
                  onChange={(e) => setSaveDir(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      localStorage.setItem("fal_save_dir", saveDir);
                      loadFiles(saveDir);
                    }
                  }}
                  placeholder="generated"
                  className="w-20 sm:w-32 rounded-lg border border-white/10 bg-white/5 px-2 py-2 sm:px-3 text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:border-violet-500/50 focus:outline-none min-w-0"
                />
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem("fal_save_dir", saveDir);
                    loadFiles(saveDir);
                  }}
                  className="rounded-lg bg-white/10 px-2 py-2 sm:px-3 text-xs sm:text-sm font-medium text-zinc-300 hover:bg-white/15 shrink-0"
                >
                  表示
                </button>
              </div>
              <Link
                href="/"
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 sm:px-4 text-xs sm:text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-zinc-200 w-full sm:w-auto min-h-[2.5rem]"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                生成に戻る
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {loading ? (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                <div className="aspect-square animate-pulse bg-white/5" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-24 animate-pulse rounded bg-white/5" />
                  <div className="h-3 w-16 animate-pulse rounded bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-20 px-8 text-center">
            <div className="mb-4 rounded-full bg-white/5 p-4">
              <svg className="h-12 w-12 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
              </svg>
            </div>
            <p className="text-zinc-500">まだ生成されたファイルはありません</p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-400"
            >
              生成ページへ
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {files.map((f) => (
              <div
                key={f.path}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition-all hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div className="aspect-square flex items-center justify-center overflow-hidden bg-white/5">
                  {f.type === "image" ? (
                    <img
                      src={previewUrl(f.path)}
                      alt={f.name}
                      className="h-full w-full object-contain"
                    />
                  ) : f.type === "video" ? (
                    <video
                      src={previewUrl(f.path)}
                      controls
                      className="h-full w-full object-contain"
                    />
                  ) : f.type === "audio" ? (
                    <div className="w-full p-4">
                      <audio src={previewUrl(f.path)} controls className="w-full" />
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-zinc-500">
                      📄 {f.name}
                    </div>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <p className="truncate text-sm font-medium text-zinc-200" title={f.name}>
                    {f.name}
                  </p>
                  <p className="text-xs text-zinc-500">{formatSize(f.size)}</p>
                  <a
                    href={downloadUrl(f.path)}
                    download={f.name}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:bg-violet-400"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    ダウンロード
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
