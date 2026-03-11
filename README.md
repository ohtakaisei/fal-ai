# fal.ai モデルエクスプローラー

fal.aiの全AIモデルを自由に選択して、画像・動画・音声・文字を生成できるWebアプリです。

## 特徴

- **全モデル対応**: fal.aiに掲載されている600以上のAIモデルから選択可能
- **カテゴリ表示**: 画像生成・動画生成・音声生成・文字生成など、モデルの種類が一目でわかる
- **フォルダ保存**: 生成したコンテンツは `generated/` フォルダに自動保存（データベース不要）
- **各自でAPIキー設定**: 画面上でキーを入力するか、環境変数で設定。GitHubに公開して誰でもデプロイ可能

## セットアップ

> **Windows ユーザー**: 詳細な手順は [docs/WINDOWS_SETUP.md](docs/WINDOWS_SETUP.md) を参照してください。

### 1. 依存関係のインストール

```bash
npm install
```

### 2. fal.ai APIキーの設定（どちらか一方でOK）

**方法A: 画面上で設定**（推奨・デプロイ時は環境変数不要）

- アプリを起動し、ヘッダーの「fal.ai APIキーを設定」をクリック
- [fal.ai ダッシュボード](https://fal.ai/dashboard/keys) でキーを取得して入力
- キーはブラウザに保存され、次回以降は自動で使用されます

**方法B: 環境変数で設定**

`.env.local` を作成：

```
FAL_KEY=your_fal_api_key_here
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで **http://localhost:3000** を開いてください。

**うまく動かない場合:**
- ポート3000が使用中のときは、ターミナルに表示されるURL（例: http://localhost:3001）を開く
- 「EMFILE: too many open files」が出る場合は `./start-dev.sh` で起動
- 既存のサーバーが動いている場合は、ターミナルで `Ctrl+C` で停止してから再度 `npm run dev`

## デプロイ（GitHub公開・Vercelなど）

このプロジェクトは **環境変数なしでもデプロイ可能** です。ユーザーが画面上で各自のAPIキーを入力して利用します。

1. GitHub にプッシュ
2. [Vercel](https://vercel.com) で「New Project」→ リポジトリを選択
3. デプロイ（FAL_KEY は任意。設定すると全員がそのキーで利用可能）
4. 公開URLを共有

詳細は [docs/DEPLOY.md](docs/DEPLOY.md) を参照してください。

## 使い方

1. 左側のモデル一覧から、カテゴリ（画像/動画/音声/文字）でフィルタリング
2. 使用したいモデルをクリックして選択
3. プロンプトを入力（画像→動画のモデルの場合は画像もアップロード）
4. 「生成する」ボタンをクリック
5. 生成されたコンテンツは `generated/` フォルダに保存されます

## 技術スタック

- Next.js 14 (App Router)
- @fal-ai/client
- Tailwind CSS
- TypeScript
