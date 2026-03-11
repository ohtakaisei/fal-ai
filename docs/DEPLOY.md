# デプロイ手順

このアプリは **各自でAPIキーを設定する方式** のため、GitHub に公開して誰でもデプロイ・利用できます。

## デプロイの2パターン

### パターンA: 環境変数なしでデプロイ（推奨）

- デプロイ時に **FAL_KEY を設定しない**
- アクセスしたユーザーが **画面上で各自のAPIキーを入力**
- キーはブラウザ（localStorage）に保存され、そのユーザー専用で利用
- **メリット**: デプロイが簡単、キー管理不要、誰でもすぐ使える

### パターンB: 環境変数でキーを設定

- デプロイ時に **FAL_KEY を環境変数で設定**
- アクセスした全員がそのキーで利用（キー入力不要）
- **メリット**: 特定のチーム・グループ向けに閉じた運用ができる

---

## Vercel でデプロイ

### 1. GitHub にプッシュ

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/あなたのユーザー名/リポジトリ名.git
git push -u origin main
```

### 2. Vercel でプロジェクト作成

1. [vercel.com](https://vercel.com) にログイン
2. 「Add New...」→「Project」
3. GitHub リポジトリを選択
4. 「Deploy」をクリック

### 3. 環境変数（任意）

パターンB の場合のみ、Vercel のプロジェクト設定で：

- **Key**: `FAL_KEY`
- **Value**: あなたの fal.ai APIキー

---

## Netlify でデプロイ

1. [netlify.com](https://netlify.com) で「Add new site」→「Import an existing project」
2. GitHub リポジトリを選択
3. ビルド設定: `npm run build`、公開ディレクトリ: `.next`
4. （Next.js の場合は Netlify の Next.js プラグインが自動で設定されます）

環境変数は `Site settings` → `Environment variables` で設定。

---

## 注意事項

- **生成ファイルの保存**: Vercel などのサーバーレス環境では、ローカルファイルへの保存ができない場合があります。その場合でも、生成結果のURLは表示されるため、ブラウザから直接ダウンロード可能です。ローカル開発時は `generated/` に保存されます。
- **APIキーの扱い**: 画面上で入力したキーは、APIリクエスト時にのみサーバーに送信され、サーバーには保存されません。
- **HTTPS**: 本番環境では必ず HTTPS で運用してください。
