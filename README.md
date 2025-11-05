<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# クリエイティブフロースタジオ

Google Geminiの複数のAI機能を統合したマルチモーダルチャットアプリケーションです。テキスト生成、画像生成・編集、動画生成を1つのインターフェースで利用できます。

**AI Studioで表示**: <https://ai.studio/apps/drive/1hanzLEEM6UDMUU_uyL5xKr7-zFedvYij>

## 主な機能

### 5つの生成モード

- **💬 チャット** - Gemini 2.5 Flashによる会話形式のテキスト生成（履歴を保持）
- **🧠 Pro** - Gemini 2.5 Proによる高度な推論（思考プロセス付き）
- **🔍 検索** - Google検索と連携したグラウンディング機能付き回答
- **🖼️ 画像生成** - Imagen 4.0による高品質な画像生成
- **🎬 動画生成** - Veo 3.1による動画生成（画像からの生成も可能）

### その他の機能

- **画像分析**: アップロードした画像の内容を説明
- **画像編集**: 生成した画像をプロンプトで編集（ホバーで編集ボタン表示）
- **マルチモーダル入力**: テキストと画像の組み合わせに対応
- **ペースト対応**: クリップボードから画像を直接貼り付け
- **アスペクト比設定**: 1:1, 16:9, 9:16, 4:3, 3:4に対応
- **進捗表示**: 動画生成時の進捗率をリアルタイム表示

## セットアップ

### 必要環境

- Node.js (推奨: 最新LTS版)

### インストール手順

1. **依存関係のインストール**

   ```bash
   npm install
   ```

2. **API キーの設定**

   [.env.local](.env.local)ファイルに以下を設定：

   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

   APIキーは[Google AI Studio](https://aistudio.google.com/apikey)で取得できます。

3. **開発サーバーの起動**

   ```bash
   npm run dev
   ```

   ブラウザで <http://localhost:3000> を開きます。

## 開発コマンド

```bash
# 開発サーバー起動（ポート3000）
npm run dev

# プロダクションビルド
npm run build

# ビルド結果のプレビュー
npm run preview
```

## 使い方

1. **モード選択**: 画面下部の入力エリアでモードボタンをクリック
2. **アスペクト比選択**: 画像・動画モードでアスペクト比ボタンをクリック
3. **ファイルアップロード**: 📎ボタンまたはペーストで画像を追加
4. **プロンプト入力**: テキストを入力して送信
5. **画像編集**: 生成された画像にホバーして✏️ボタンをクリック

## 技術スタック

- **フロントエンド**: React 19 + TypeScript
- **ビルドツール**: Vite 6
- **AI SDK**: @google/genai
- **スタイリング**: Tailwind CSS (CDN経由)
- **使用モデル**:
  - Gemini 2.5 Flash (チャット・検索・画像分析)
  - Gemini 2.5 Pro (高度な推論)
  - Gemini 2.5 Flash Image (画像編集)
  - Imagen 4.0 (画像生成)
  - Veo 3.1 Fast (動画生成)

## プロジェクト構造

```text
/
├── App.tsx                  # メインアプリケーション & 状態管理
├── types.ts                 # TypeScript型定義
├── components/
│   ├── ChatInput.tsx       # 入力エリア & モード切り替え
│   ├── ChatMessage.tsx     # メッセージ表示（テキスト/画像/動画）
│   ├── ApiKeyModal.tsx     # APIキー選択ダイアログ
│   └── icons.tsx           # アイコンコンポーネント
├── services/
│   └── geminiService.ts    # Gemini API統合レイヤー
└── utils/
    └── fileUtils.ts        # ファイル/Base64変換ユーティリティ
```

## アーキテクチャのポイント

- **サービス層パターン**: すべてのGemini API呼び出しは`geminiService.ts`に集約
- **非同期動画生成**: ポーリングによる進捗管理とステータス更新
- **フレッシュAPIクライアント**: リクエスト毎に新しいクライアントを生成し、最新のAPIキーを使用
- **型安全性**: TypeScriptで厳密な型定義を実装

詳細なアーキテクチャ情報は[CLAUDE.md](CLAUDE.md)を参照してください。
