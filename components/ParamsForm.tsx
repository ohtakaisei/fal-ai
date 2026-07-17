"use client";

import { useState } from "react";
import type { SchemaField } from "@/lib/schema";

interface Props {
  fields: SchemaField[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
}

// 日本語ラベル（よく使われるパラメータのみ。無ければ英語名を表示）
const LABELS: Record<string, string> = {
  negative_prompt: "ネガティブプロンプト",
  image_size: "画像サイズ",
  aspect_ratio: "アスペクト比",
  resolution: "解像度",
  duration: "長さ（秒）",
  num_images: "生成枚数",
  num_inference_steps: "推論ステップ数",
  guidance_scale: "ガイダンススケール",
  seed: "シード値",
  output_format: "出力形式",
  enable_safety_checker: "セーフティチェック",
  safety_tolerance: "セーフティ許容度",
  cfg_scale: "CFGスケール",
  motion_bucket_id: "モーション強度",
  fps: "FPS",
  num_frames: "フレーム数",
  strength: "強度",
  style: "スタイル",
  quality: "画質",
  mode: "モード",
  model: "モデルタイプ",
  voice: "ボイス",
  speed: "速度",
  camera_control: "カメラ制御",
  generate_audio: "音声を生成",
  enhance_prompt: "プロンプト自動強化",
  expand_prompt: "プロンプト自動拡張",
};

const labelOf = (f: SchemaField) => LABELS[f.name] || f.title || f.name;

function FieldControl({ field, value, onChange }: { field: SchemaField; value: unknown; onChange: (v: unknown) => void }) {
  const inputCls =
    "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-violet-500/50 focus:outline-none";

  if (field.type === "enum") {
    return (
      <select
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange(undefined);
          // 数値enumなら数値に戻す
          const match = field.enum?.find((opt) => String(opt) === raw);
          onChange(match ?? raw);
        }}
        className={inputCls}
      >
        {!field.required && <option value="">（未指定）</option>}
        {(field.enum || []).map((opt) => (
          <option key={String(opt)} value={String(opt)}>
            {String(opt)}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "boolean") {
    return (
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-violet-500"
        />
        <span className="text-sm text-zinc-300">{value === true ? "有効" : "無効"}</span>
      </label>
    );
  }

  if (field.type === "integer" || field.type === "number") {
    return (
      <input
        type="number"
        value={value === undefined || value === null ? "" : String(value)}
        min={field.minimum}
        max={field.maximum}
        step={field.type === "integer" ? 1 : 0.1}
        placeholder={
          field.minimum != null && field.maximum != null
            ? `${field.minimum}〜${field.maximum}`
            : field.default != null
            ? String(field.default)
            : ""
        }
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange(undefined);
          const n = field.type === "integer" ? parseInt(raw, 10) : parseFloat(raw);
          onChange(Number.isFinite(n) ? n : undefined);
        }}
        className={inputCls}
      />
    );
  }

  return (
    <input
      type="text"
      value={value === undefined || value === null ? "" : String(value)}
      placeholder={field.default != null ? String(field.default) : ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
      className={inputCls}
    />
  );
}

export default function ParamsForm({ fields, values, onChange }: Props) {
  const [open, setOpen] = useState(false);

  if (fields.length === 0) return null;

  // 料金や結果に直結する主要項目は常時表示、それ以外は「詳細設定」に折りたたみ
  const PRIMARY = new Set([
    "image_size",
    "aspect_ratio",
    "resolution",
    "duration",
    "num_images",
    "quality",
    "output_format",
    "style",
    "mode",
    "model",
  ]);
  const primary = fields.filter((f) => PRIMARY.has(f.name) || f.required);
  const advanced = fields.filter((f) => !PRIMARY.has(f.name) && !f.required);

  const renderGrid = (list: SchemaField[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {list.map((f) => (
        <div key={f.name} className="min-w-0">
          <label
            className="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-400"
            title={f.description || f.name}
          >
            <span className="truncate">{labelOf(f)}</span>
            {f.required && (
              <span className="shrink-0 rounded bg-red-500/15 px-1 py-px text-[10px] text-red-400">必須</span>
            )}
            {f.description && (
              <span className="shrink-0 cursor-help text-zinc-600" title={f.description}>ⓘ</span>
            )}
          </label>
          <FieldControl field={f} value={values[f.name]} onChange={(v) => onChange(f.name, v)} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      {primary.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-zinc-300">生成設定</p>
          {renderGrid(primary)}
        </div>
      )}
      {advanced.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02]">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-zinc-300 hover:text-zinc-100"
          >
            <span>詳細設定（{advanced.length}項目）</span>
            <svg
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {open && <div className="border-t border-white/5 p-4">{renderGrid(advanced)}</div>}
        </div>
      )}
    </div>
  );
}
