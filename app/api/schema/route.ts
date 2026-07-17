import { NextRequest, NextResponse } from "next/server";
import { getFalKeyFromRequest } from "@/lib/fal-key";
import type { SchemaField } from "@/lib/schema";

export const dynamic = "force-dynamic";

// モデルの入力スキーマを取得して平坦化して返す
// GET https://api.fal.ai/v1/models?endpoint_id=...&expand=openapi-3.0

type JsonSchema = {
  $ref?: string;
  type?: string | string[];
  enum?: (string | number)[];
  const?: string | number;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  description?: string;
  title?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  items?: JsonSchema;
  [key: string]: unknown;
};

function resolveRef(schema: JsonSchema | undefined, components: Record<string, JsonSchema>): JsonSchema | undefined {
  if (!schema) return undefined;
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop() || "";
    return resolveRef(components[name], components);
  }
  return schema;
}

// anyOf/oneOf/allOf をほどいて、UIで扱いやすい単一表現に正規化
function normalize(
  prop: JsonSchema,
  components: Record<string, JsonSchema>
): { type: SchemaField["type"]; enum?: (string | number)[]; base: JsonSchema } | null {
  const resolved = resolveRef(prop, components);
  if (!resolved) return null;

  const variants: JsonSchema[] = [];
  const collect = (s: JsonSchema | undefined) => {
    const r = resolveRef(s, components);
    if (!r) return;
    if (r.anyOf || r.oneOf || r.allOf) {
      [...(r.anyOf || []), ...(r.oneOf || []), ...(r.allOf || [])].forEach(collect);
    } else {
      variants.push(r);
    }
  };
  collect(resolved);

  // enum を持つバリアントを最優先（例: image_size は enum | {width,height} の anyOf）
  const enumVariant = variants.find((v) => Array.isArray(v.enum) && v.enum.length > 0);
  if (enumVariant) {
    return { type: "enum", enum: enumVariant.enum, base: { ...resolved, ...enumVariant } };
  }

  const typeOf = (v: JsonSchema): string | null => {
    const t = Array.isArray(v.type) ? v.type.find((x) => x !== "null") : v.type;
    return t || null;
  };

  for (const v of variants) {
    const t = typeOf(v);
    if (t === "boolean") return { type: "boolean", base: { ...resolved, ...v } };
    if (t === "integer") return { type: "integer", base: { ...resolved, ...v } };
    if (t === "number") return { type: "number", base: { ...resolved, ...v } };
    if (t === "string") return { type: "string", base: { ...resolved, ...v } };
  }
  return null; // object / array 等は非対応（専用UIかスキップ）
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpointId = searchParams.get("endpoint_id");
  if (!endpointId) {
    return NextResponse.json({ error: "endpoint_id を指定してください" }, { status: 400 });
  }

  const apiKey = getFalKeyFromRequest(request);
  const headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `Key ${apiKey}`;

  try {
    const res = await fetch(
      `https://api.fal.ai/v1/models?endpoint_id=${encodeURIComponent(endpointId)}&expand=openapi-3.0`,
      { headers, cache: "no-store" }
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: `fal.ai API error: ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    const spec = data.models?.[0]?.openapi;
    if (!spec || spec.error) {
      return NextResponse.json({ fields: [], note: "スキーマを取得できませんでした" });
    }

    const components: Record<string, JsonSchema> = spec.components?.schemas || {};

    // POST の requestBody から入力スキーマを特定
    let inputSchema: JsonSchema | undefined;
    for (const pathItem of Object.values(spec.paths || {}) as Record<string, JsonSchema>[]) {
      const post = pathItem?.post as JsonSchema | undefined;
      const content = (post as { requestBody?: { content?: Record<string, { schema?: JsonSchema }> } })
        ?.requestBody?.content;
      const schema = content?.["application/json"]?.schema;
      if (schema) {
        inputSchema = resolveRef(schema, components);
        if (inputSchema?.properties) break;
      }
    }
    // フォールバック: "Input" で終わるコンポーネント名
    if (!inputSchema?.properties) {
      const key = Object.keys(components).find((k) => /input$/i.test(k));
      if (key) inputSchema = components[key];
    }

    if (!inputSchema?.properties) {
      return NextResponse.json({ fields: [], note: "入力スキーマが見つかりませんでした" });
    }

    const requiredSet = new Set(inputSchema.required || []);
    const order: string[] = Array.isArray(inputSchema["x-fal-order-properties"])
      ? (inputSchema["x-fal-order-properties"] as string[])
      : Object.keys(inputSchema.properties);

    const fields: SchemaField[] = [];
    for (const name of order) {
      const prop = inputSchema.properties[name];
      if (!prop) continue;
      const norm = normalize(prop, components);
      if (!norm) continue;
      const base = norm.base;
      const def = base.default;
      fields.push({
        name,
        title: typeof base.title === "string" ? base.title : undefined,
        type: norm.type,
        enum: norm.enum,
        default:
          typeof def === "string" || typeof def === "number" || typeof def === "boolean"
            ? def
            : undefined,
        minimum: typeof base.minimum === "number" ? base.minimum : base.exclusiveMinimum,
        maximum: typeof base.maximum === "number" ? base.maximum : base.exclusiveMaximum,
        description: typeof base.description === "string" ? base.description : undefined,
        required: requiredSet.has(name),
      });
    }

    return NextResponse.json({ fields });
  } catch (e) {
    console.error("Schema API error:", e);
    return NextResponse.json({ error: "スキーマの取得に失敗しました" }, { status: 500 });
  }
}
