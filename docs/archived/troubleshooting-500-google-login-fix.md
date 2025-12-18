# Google ログイン 500 エラー解決報告

**日付**: 2025-11-30  
**問題**: Cloud Run で Google アカウントログイン時に 500 Internal Server Error が発生  
**ステータス**: ✅ 解決済み

---

## 問題の原因

### エラーメッセージ
```
Error: Missing required environment variable: GOOGLE_CLIENT_ID
```

### 根本原因
Cloud Run サービス `creative-flow-studio-dev` に必要な環境変数が全く設定されていませんでした。

1. **環境変数が未設定**: Cloud Run サービスの `env` と `envFrom` が `null`
2. **Secret Manager からの注入も未設定**: Secret Manager にシークレットは存在するが、Cloud Run サービスにマウントされていない

---

## 実施した修正

### 1. 環境変数の設定

#### NextAuth 関連
```bash
# NEXTAUTH_URL を直接設定
gcloud run services update creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --update-env-vars="NEXTAUTH_URL=https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app"

# NEXTAUTH_SECRET を Secret Manager から注入
gcloud run services update creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --set-secrets="NEXTAUTH_SECRET=nextauth-secret:latest"
```

#### Google OAuth 関連
```bash
# Google OAuth 認証情報を Secret Manager から注入
gcloud run services update creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --set-secrets="GOOGLE_CLIENT_ID=google-client-id:latest,GOOGLE_CLIENT_SECRET=google-client-secret:latest"
```

#### データベース接続
```bash
# DATABASE_URL を Secret Manager から注入
gcloud run services update creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --update-secrets="DATABASE_URL=database-url:latest"
```

#### その他の環境変数
```bash
# アプリケーション URL
gcloud run services update creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --update-env-vars="NEXT_PUBLIC_APP_URL=https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app"

# Gemini API キーと Stripe 関連
gcloud run services update creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --update-secrets="GEMINI_API_KEY=gemini-api-key:latest,STRIPE_SECRET_KEY=stripe-secret-key:latest,STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest"
```

### 2. 設定後の環境変数確認

最終的に以下の環境変数が設定されました：

| 環境変数名              | ソース                                      | 説明                                                       |
|-------------------------|------------------------------------------|------------------------------------------------------------|
| `NEXTAUTH_URL`          | 直接設定                                 | `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app` |
| `NEXTAUTH_SECRET`       | Secret Manager (`nextauth-secret`)       | NextAuth セッション暗号化キー                                     |
| `GOOGLE_CLIENT_ID`      | Secret Manager (`google-client-id`)      | Google OAuth クライアント ID                                     |
| `GOOGLE_CLIENT_SECRET`  | Secret Manager (`google-client-secret`)  | Google OAuth クライアントシークレット                                  |
| `DATABASE_URL`          | Secret Manager (`database-url`)          | PostgreSQL 接続文字列                                      |
| `GEMINI_API_KEY`        | Secret Manager (`gemini-api-key`)        | Gemini API キー                                              |
| `STRIPE_SECRET_KEY`     | Secret Manager (`stripe-secret-key`)     | Stripe シークレットキー                                            |
| `STRIPE_WEBHOOK_SECRET` | Secret Manager (`stripe-webhook-secret`) | Stripe Webhook シークレット                                      |
| `NEXT_PUBLIC_APP_URL`   | 直接設定                                 | `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app` |

---

## 確認コマンド

### 環境変数の確認
```bash
gcloud run services describe creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --format=json | jq '.spec.template.spec.containers[0].env[] | {name: .name, source: (if .valueFrom then "secret: \(.valueFrom.secretKeyRef.name)" else "env: \(.value)" end)}'
```

### エラーログの確認
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND \
   resource.labels.service_name=creative-flow-studio-dev AND \
   severity>=ERROR" \
  --project=dataanalyticsclinic \
  --limit=10 \
  --format="table(timestamp,severity,textPayload)" \
  --freshness=1h
```

---

## 次のステップ: Google OAuth リダイレクト URI の確認

環境変数は設定されましたが、**Google OAuth のリダイレクト URI が正しく設定されているか確認**する必要があります。

### 確認方法

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=dataanalyticsclinic) にアクセス
2. **認証情報** → **OAuth 2.0 クライアント ID** を選択
3. 使用中のクライアント ID を編集

### 必須設定

以下の URI が **承認済みのリダイレクト URI** に追加されていることを確認：

```
https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/api/auth/callback/google
```

以下の URL が **承認済みの JavaScript 生成元** に追加されていることを確認：

```
https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app
```

### 設定されていない場合

1. Google Cloud Console で OAuth 2.0 クライアント ID を編集
2. 上記の URI/URL を追加
3. 保存

---

## 検証手順

1. **ブラウザでアプリにアクセス**
   ```
   https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app
   ```

2. **Google でログインボタンをクリック**

3. **Google アカウントを選択してログイン**

4. **正常にリダイレクトされ、セッションが確立されることを確認**

5. **エラーが発生する場合**
   - ブラウザの開発者ツール（F12）でエラーメッセージを確認
   - Cloud Run のログを確認（上記の確認コマンドを使用）
   - Google OAuth のリダイレクト URI 設定を再確認

---

## トラブルシューティング

### まだ 500 エラーが発生する場合

1. **環境変数が正しく設定されているか再確認**
   ```bash
   gcloud run services describe creative-flow-studio-dev \
     --region=asia-northeast1 \
     --project=dataanalyticsclinic \
     --format=json | jq '.spec.template.spec.containers[0].env'
   ```

2. **Secret Manager のシークレットが存在するか確認**
   ```bash
   gcloud secrets list --project=dataanalyticsclinic
   ```

3. **Cloud Run サービスアカウントに Secret Manager へのアクセス権限があるか確認**
   ```bash
   gcloud projects get-iam-policy dataanalyticsclinic \
     --flatten="bindings[].members" \
     --filter="bindings.members:cloud-run-runtime@dataanalyticsclinic.iam.gserviceaccount.com"
   ```

4. **最新のエラーログを確認**
   ```bash
   gcloud logging read \
     "resource.type=cloud_run_revision AND \
      resource.labels.service_name=creative-flow-studio-dev AND \
      severity>=ERROR" \
     --project=dataanalyticsclinic \
     --limit=5 \
     --format=json \
     --freshness=10m
   ```

### リダイレクト URI エラーが発生する場合

エラーメッセージが `redirect_uri_mismatch` の場合：

1. Google Cloud Console で OAuth 2.0 クライアント ID を確認
2. リダイレクト URI が正確に一致しているか確認（末尾のスラッシュ、プロトコル、ドメイン）
3. 数分待ってから再試行（設定が反映されるまで時間がかかる場合がある）

---

## 参考資料

- [NextAuth.js Cloud Run 設定ガイド](./nextauth-cloud-run-setup.md)
- [NextAuth環境変数設定手順](./deployment-instructions-auth-fix.md)
- [Google OAuth 設定ガイド](./google-oauth-setup-guide.md)

---

## 最終確認

✅ 環境変数がすべて設定されている  
✅ Secret Manager から正しく注入されている  
✅ 新しいリビジョンでエラーが解消された  
⏳ Google OAuth リダイレクト URI の設定確認が必要（手動）

**次のアクション**: Google Cloud Console で OAuth リダイレクト URI を確認・設定してください。



