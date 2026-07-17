"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "生成" },
  { href: "/history", label: "履歴" },
  { href: "/generated", label: "ファイル" },
];

export default function AppHeader() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [falKey, setFalKey] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceNote, setBalanceNote] = useState<string | null>(null);
  const [totalUsage, setTotalUsage] = useState<number | null>(null);

  useEffect(() => {
    const k = localStorage.getItem("fal_api_key") || "";
    setFalKey(k);
    setKeyDraft(k);
    setMounted(true);
  }, []);

  const headers = useCallback(
    (): Record<string, string> => (falKey ? { "X-FAL-Key": falKey } : {}),
    [falKey]
  );

  const refreshStats = useCallback(() => {
    // 残クレジット（Adminキーが必要）
    fetch("/api/balance", { headers: headers() })
      .then((r) => r.json())
      .then((d) => {
        if (d.balance != null) {
          setBalance(d.balance);
          setBalanceNote(null);
        } else {
          setBalance(null);
          setBalanceNote(d.needAdminKey ? "残高表示には Admin スコープのキーが必要です" : null);
        }
      })
      .catch(() => setBalance(null));

    // 累計使用額
    fetch("/api/usage", { headers: headers() })
      .then((r) => r.json())
      .then((d) => {
        if (!d.error && d.totalCost != null) setTotalUsage(d.totalCost);
      })
      .catch(() => {});
  }, [headers]);

  useEffect(() => {
    if (!mounted) return;
    refreshStats();
  }, [mounted, falKey, refreshStats]);

  // 生成完了時に残高・累計を更新
  useEffect(() => {
    const onGenerated = () => refreshStats();
    window.addEventListener("fal-generated", onGenerated);
    return () => window.removeEventListener("fal-generated", onGenerated);
  }, [refreshStats]);

  const saveKey = (key: string) => {
    const trimmed = key.trim();
    localStorage.setItem("fal_api_key", trimmed);
    setFalKey(trimmed);
    setShowKeyInput(false);
    // 他コンポーネント（生成ページ等）へ通知
    window.dispatchEvent(new CustomEvent("fal-key-changed", { detail: trimmed }));
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0c0c0f]/95 backdrop-blur-md safe-area-inset-top">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 items-center justify-between gap-2">
            <div className="flex items-center gap-3 sm:gap-6 min-w-0">
              <Link href="/" className="shrink-0 text-base sm:text-lg font-semibold tracking-tight">
                <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
                  fal.ai Studio
                </span>
              </Link>
              <nav className="flex items-center gap-1 rounded-full bg-white/5 p-1">
                {NAV_ITEMS.map((item) => {
                  const active =
                    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-full px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                        active
                          ? "bg-violet-500 text-white shadow shadow-violet-500/25"
                          : "text-zinc-400 hover:text-zinc-100"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {mounted && falKey && (
                <div className="hidden md:flex items-center gap-2">
                  <div
                    className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs"
                    title={balanceNote ?? "fal.ai の残クレジット"}
                  >
                    <span className="text-zinc-400">残高</span>
                    <span className="font-semibold text-emerald-400">
                      {balance != null ? `$${balance.toFixed(2)}` : "—"}
                    </span>
                  </div>
                  {totalUsage != null && (
                    <div
                      className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs"
                      title="このアカウントの累計使用額（推定）"
                    >
                      <span className="text-zinc-400">累計</span>
                      <span className="font-semibold text-amber-400">
                        ${totalUsage.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {mounted && (
                <button
                  type="button"
                  onClick={() => {
                    setKeyDraft(falKey);
                    setShowKeyInput(true);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors min-h-[2.25rem] ${
                    falKey
                      ? "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                      : "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                  }`}
                  title={falKey ? "APIキーを変更" : "fal.ai APIキーを設定"}
                >
                  {falKey ? "🔑" : "APIキーを設定"}
                </button>
              )}
            </div>
          </div>
          {mounted && falKey && balanceNote && (
            <p className="pb-2 -mt-1 text-[11px] text-zinc-600 md:hidden lg:block">
              {balanceNote}
            </p>
          )}
        </div>
      </header>

      {showKeyInput && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
          <div className="mx-0 sm:mx-4 w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0c0c0f] p-4 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto safe-area-inset-bottom">
            <h3 className="mb-4 text-lg font-semibold text-zinc-200">fal.ai APIキー</h3>
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
              残高表示や履歴取得には <span className="text-zinc-300">Admin スコープ</span> のキーを推奨します。
            </p>
            <input
              type="password"
              placeholder="fal-xxxxxxxx..."
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveKey(keyDraft)}
              className="mb-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:border-violet-500/50 focus:outline-none"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => saveKey(keyDraft)}
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
    </>
  );
}
