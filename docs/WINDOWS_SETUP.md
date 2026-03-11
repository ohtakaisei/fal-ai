# Windows での実行方法

このプロジェクトは **Windows でも実行できます**。Next.js と Node.js はクロスプラットフォーム対応のため、macOS と同様に動作します。

## 前提条件

- **Node.js 18.x 以上**（推奨: LTS 版）
- **npm**（Node.js に同梱）

## セットアップ手順

### 1. Node.js のインストール

1. [Node.js 公式サイト](https://nodejs.org/ja/) にアクセス
2. **LTS（推奨）** をダウンロード
3. インストーラーを実行し、指示に従ってインストール
4. インストール後、**新しいコマンドプロンプトまたは PowerShell** を開き、以下で確認：

```powershell
node -v
npm -v
```

### 2. プロジェクトのクローン・展開

プロジェクトフォルダに移動します。

```powershell
cd C:\path\to\Fal_AI
```

（`C:\path\to\Fal_AI` は実際のプロジェクトのパスに置き換えてください）

### 3. 依存関係のインストール

```powershell
npm install
```

### 4. API キーの設定

1. [fal.ai ダッシュボード](https://fal.ai/dashboard/keys) で API キーを取得
2. プロジェクトルートに `.env.local` ファイルを作成
3. 以下の内容を記述（`your_fal_api_key_here` を実際のキーに置き換え）：

```
FAL_KEY=your_fal_api_key_here
```

**注意**: `.env.local` は Git にコミットしないでください（`.gitignore` に含まれています）。

### 5. 開発サーバーの起動

```powershell
npm run dev
```

起動後、ブラウザで **http://localhost:3000** を開いてください。

## よく使うコマンド

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバーを起動（ホットリロード有効） |
| `npm run build` | 本番用ビルド |
| `npm run start` | ビルド後の本番サーバーを起動 |
| `npm run lint` | コードのリント実行 |

## トラブルシューティング

### ポート 3000 が使用中の場合

別のポートで起動するには、`package.json` の `dev` スクリプトを変更するか、以下を実行：

```powershell
npx next dev -p 3001
```

### 既存のサーバーを停止する

ターミナルで `Ctrl + C` を押してサーバーを停止してから、再度 `npm run dev` を実行してください。

### 「EMFILE: too many open files」エラーについて

このエラーは主に **macOS** で発生します。Windows では通常発生しません。Windows の場合は `npm run dev` をそのまま使用してください。

> **補足**: `start-dev.sh` は macOS/Linux 用のスクリプトです。Windows では使用できませんが、上記のエラーが Windows で出ることはほぼないため、`npm run dev` で問題ありません。

### パスに日本語が含まれる場合

プロジェクトのパスに日本語（例: `C:\Users\ユーザー名\...`）が含まれていても、通常は問題なく動作します。エラーが出る場合は、英語のみのパス（例: `C:\dev\Fal_AI`）に移動して試してください。

### PowerShell で実行権限エラーが出る場合

スクリプト実行が制限されている場合、管理者権限で PowerShell を開き、以下を実行：

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 生成ファイルの保存場所

生成した画像・動画・音声は、プロジェクトルートの `generated/` フォルダに保存されます。パス例：

```
C:\path\to\Fal_AI\generated\
```
