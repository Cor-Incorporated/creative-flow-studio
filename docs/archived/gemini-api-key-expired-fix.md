# Gemini APIキー期限切れ修正ガイド

**作成日**: 2025-11-30  
**問題**: Gemini APIキーが期限切れ  
**エラーメッセージ**: `API key expired. Please renew the API key.`

---

## 🔍 問題の詳細

### エラーログ

```
Gemini Chat API Error: tC [ApiError]: {
  "error": {
    "code": 400,
    "message": "API key expired. Please renew the API key.",
    "status": "INVALID_ARGUMENT",
    "details": [{
      "@type": "type.googleapis.com/google.rpc.ErrorInfo",
      "reason": "API_KEY_INVALID",
      "domain": "googleapis.com"
    }]
  }
}
```

### 原因

Secret Managerの`gemini-api-key`に保存されているAPIキーが期限切れになっています。

---

## ✅ 解決方法

### 1. 新しいGemini APIキーを取得

1. [Google AI Studio](https://makersuite.google.com/app/apikey)にアクセス
2. 新しいAPIキーを生成
3. APIキーをコピー

### 2. Secret Managerに新しいAPIキーを設定

```bash
# 新しいAPIキーをSecret Managerに設定
echo -n "YOUR_NEW_API_KEY" | gcloud secrets versions add gemini-api-key \
  --project=dataanalyticsclinic \
  --data-file=-
```

**注意**: `YOUR_NEW_API_KEY`を実際の新しいAPIキーに置き換えてください。

### 3. Cloud Runサービスの再デプロイ（自動）

Secret Managerの値を更新すると、Cloud Runサービスは自動的に新しいバージョンを読み込みます。ただし、明示的に再デプロイする場合は：

```bash
gcloud run services update creative-flow-studio \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --update-secrets=GEMINI_API_KEY=gemini-api-key:latest
```

---

## 📋 確認方法

### Secret Managerの最新バージョンを確認

```bash
gcloud secrets versions list gemini-api-key \
  --project=dataanalyticsclinic \
  --limit=1
```

### Cloud Runのログを確認

```bash
gcloud run services logs read creative-flow-studio \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --limit=20
```

新しいAPIキーが正しく読み込まれていれば、エラーは解消されます。

---

## 🔗 関連ドキュメント

- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)

---

**修正完了日**: 2025-11-30  
**担当**: Claude Code
