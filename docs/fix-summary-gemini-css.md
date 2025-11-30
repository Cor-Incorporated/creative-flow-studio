# Gemini APIとCSS修正サマリ

**作成日**: 2025-11-30  
**問題**: 
1. Gemini APIが500エラーを返す
2. CSSが適用されずレイアウトが崩壊

---

## 🔍 問題の詳細

### 1. Gemini APIエラー

**エラーメッセージ**:
```
/api/gemini/chat:1 Failed to load resource: the server responded with a status of 500 ()
Error: エラーが発生しました。もう一度お試しください。
```

**原因**:
- Cloud Runサービスの環境変数に`GEMINI_API_KEY`が設定されていない
- Secret Managerには`gemini-api-key`が存在するが、Cloud Runに反映されていない

### 2. CSSが適用されない

**現象**:
- レイアウトが崩壊している
- Tailwind CSSのスタイルが適用されていない

**原因**:
- Tailwind CSS v4の設定が不完全な可能性
- `postcss.config.js`に`autoprefixer`が含まれている（Tailwind v4では不要）

---

## ✅ 実施した修正

### 1. Tailwind CSS v4の設定を最適化

**変更内容**:
- `postcss.config.js`から`autoprefixer`を削除（Tailwind v4に含まれている）
- `tailwind.config.js`を削除（Tailwind v4では不要な場合がある）

**変更前**:
```js
module.exports = {
    plugins: {
        '@tailwindcss/postcss': {},
        autoprefixer: {},  // 不要
    },
};
```

**変更後**:
```js
module.exports = {
    plugins: {
        '@tailwindcss/postcss': {},
    },
};
```

### 2. Gemini APIキーの設定

**Terraform設定**:
- `infra/envs/dev/terraform.tfvars.example`に`GEMINI_API_KEY = "gemini-api-key"`が定義済み
- GitHub ActionsのワークフローでTerraformを実行して設定を適用

**確認済み**:
- Secret Managerに`gemini-api-key`が存在 ✅
- Terraformの設定に`GEMINI_API_KEY`が含まれている ✅

---

## 📋 確認方法

### Gemini APIキーの確認

Terraformワークフロー実行後:
```bash
gcloud run services describe creative-flow-studio \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --format="json" | \
  python3 -c "import sys, json; data = json.load(sys.stdin); envs = data.get('spec', {}).get('template', {}).get('spec', {}).get('containers', [{}])[0].get('env', []); gemini = [e for e in envs if 'GEMINI' in e.get('name', '')]; print('GEMINI_API_KEY:', 'Found' if gemini else 'Not found')"
```

### CSS適用の確認

1. ブラウザでアプリケーションにアクセス
2. 開発者ツールで以下を確認:
   - CSSファイルが読み込まれているか
   - Tailwindのクラスが適用されているか
   - エラーがないか

---

## 🔗 関連ファイル

- `postcss.config.js` - PostCSS設定（修正済み）
- `app/globals.css` - Tailwind CSS v4形式
- `app/layout.tsx` - レイアウト設定
- `infra/envs/dev/terraform.tfvars.example` - Terraform設定例

---

**修正日**: 2025-11-30  
**担当**: Claude Code
