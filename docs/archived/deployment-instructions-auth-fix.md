# NextAuth環境変数設定手順（Cursor向け）

**作成日**: 2025-11-17
**対象環境**: Cloud Run dev環境
**目的**: NextAuthセッション生成の有効化による401エラー解消

---

## 問題の概要

**現象**: Cloud Run dev環境でログインできず、全APIが401 Unauthorized を返す

**根本原因** (調査結果):
1. **フロント側は問題なし**:
   - ✅ ヘッダーにログイン/ログアウトボタンあり (app/page.tsx:828-861)
   - ✅ 認証ガード実装済み (app/page.tsx:495-505)
   - ✅ Google OAuth誘導も実装済み

2. **真の問題はバックエンド/インフラ側**:
   - ❌ Cloud Run dev環境でNextAuth環境変数が未設定
   - ❌ Google OAuthのAuthorized Redirect URIが未登録
   - ❌ Secret Managerの設定が不完全

**結果**: ログインボタンはあるが、クリックしてもセッションが生成されず、常に401エラー

---

## 必要な環境変数一覧

### 1. NextAuth設定

| 環境変数 | 値 | 説明 |
|---------|-----|------|
| `NEXTAUTH_URL` | `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app` | Cloud Run dev環境のURL |
| `NEXTAUTH_SECRET` | `<openssl rand -base64 32で生成>` | セッション暗号化キー |

### 2. Google OAuth設定

| 環境変数 | 値 | 説明 |
|---------|-----|------|
| `GOOGLE_CLIENT_ID` | `<Google Cloud Consoleから取得>` | OAuth 2.0クライアントID |
| `GOOGLE_CLIENT_SECRET` | `<Google Cloud Consoleから取得>` | OAuth 2.0クライアントシークレット |

### 3. その他必須環境変数

| 環境変数 | 値 | 説明 |
|---------|-----|------|
| `DATABASE_URL` | `postgresql://...` | Cloud SQL接続文字列 |
| `GEMINI_API_KEY` | `AIza...` | Gemini API キー |
| `STRIPE_SECRET_KEY` | `sk_test_...` | Stripe シークレットキー（テストモード） |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe Webhookシークレット |

---

## ステップ1: Google OAuth設定

### 1.1 OAuth 2.0クライアントの作成/更新

```bash
# Google Cloud Console にアクセス
open https://console.cloud.google.com/apis/credentials?project=dataanalyticsclinic
```

**手順**:
1. **「認証情報」** → **「認証情報を作成」** → **「OAuth 2.0 クライアント ID」**
2. アプリケーションの種類: **「ウェブ アプリケーション」**
3. 名前: `creative-flow-studio-dev`
4. **承認済みのリダイレクト URI** に以下を追加:
   ```
   https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/api/auth/callback/google
   ```
5. **作成** をクリック
6. 表示された **クライアント ID** と **クライアント シークレット** をコピー

### 1.2 Authorized JavaScript origins（オプション）

以下も追加することを推奨:
```
https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app
```

---

## ステップ2: Secret Manager設定

### 2.1 NEXTAUTH_SECRET の生成

```bash
# 新しいシークレットを生成
openssl rand -base64 32

# 出力例: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### 2.2 Secret Managerにシークレットを追加/更新

```bash
# プロジェクトIDを確認
export PROJECT_ID=dataanalyticsclinic

# 1. NEXTAUTH_URL
echo -n "https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app" | \
  gcloud secrets create nextauth-url \
  --data-file=- \
  --project=$PROJECT_ID \
  --replication-policy="automatic"

# または既存のシークレットを更新
echo -n "https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app" | \
  gcloud secrets versions add nextauth-url \
  --data-file=- \
  --project=$PROJECT_ID

# 2. NEXTAUTH_SECRET
echo -n "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" | \
  gcloud secrets create nextauth-secret \
  --data-file=- \
  --project=$PROJECT_ID \
  --replication-policy="automatic"

# 3. GOOGLE_CLIENT_ID (ステップ1で取得した値)
echo -n "123456789-abcdefg.apps.googleusercontent.com" | \
  gcloud secrets create google-client-id \
  --data-file=- \
  --project=$PROJECT_ID \
  --replication-policy="automatic"

# 4. GOOGLE_CLIENT_SECRET (ステップ1で取得した値)
echo -n "GOCSPX-xxxxxxxxxxxxxxxx" | \
  gcloud secrets create google-client-secret \
  --data-file=- \
  --project=$PROJECT_ID \
  --replication-policy="automatic"
```

### 2.3 Cloud Run サービスアカウントに権限付与

```bash
# Cloud Run のサービスアカウントを確認
gcloud run services describe creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=$PROJECT_ID \
  --format="value(spec.template.spec.serviceAccountName)"

# 出力例: cloud-run-runtime@dataanalyticsclinic.iam.gserviceaccount.com

# Secret Manager へのアクセス権を付与
export SERVICE_ACCOUNT=cloud-run-runtime@dataanalyticsclinic.iam.gserviceaccount.com

for SECRET in nextauth-url nextauth-secret google-client-id google-client-secret; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID
done
```

---

## ステップ3: Cloud Run環境変数設定

### 3.1 Terraformで環境変数を設定（推奨）

`infra/envs/dev/main.tf` を更新:

```hcl
resource "google_cloud_run_service" "creative_flow_studio" {
  # ... 既存設定 ...

  template {
    spec {
      containers {
        # ... 既存設定 ...

        env {
          name = "NEXTAUTH_URL"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.nextauth_url.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "NEXTAUTH_SECRET"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.nextauth_secret.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "GOOGLE_CLIENT_ID"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.google_client_id.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "GOOGLE_CLIENT_SECRET"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.google_client_secret.secret_id
              key  = "latest"
            }
          }
        }
      }
    }
  }
}

# Secret Manager リソース定義
resource "google_secret_manager_secret" "nextauth_url" {
  secret_id = "nextauth-url"
  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret" "nextauth_secret" {
  secret_id = "nextauth-secret"
  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret" "google_client_id" {
  secret_id = "google-client-id"
  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret" "google_client_secret" {
  secret_id = "google-client-secret"
  replication {
    automatic = true
  }
}
```

### 3.2 Terraform適用

```bash
cd infra/envs/dev

# 初期化（初回のみ）
terraform init

# 変更内容を確認
terraform plan

# 適用
terraform apply
```

### 3.3 手動でCloud Run環境変数を設定（Terraform使わない場合）

```bash
# Cloud Runサービスの現在の設定を取得
gcloud run services describe creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=$PROJECT_ID \
  --format=yaml > service.yaml

# service.yamlを編集してenv変数を追加

# 更新を適用
gcloud run services replace service.yaml \
  --region=asia-northeast1 \
  --project=$PROJECT_ID
```

---

## ステップ4: デプロイと検証

### 4.1 コードのデプロイ（Claude Codeの修正を含む）

```bash
# 作業ディレクトリの確認
pwd
# Expected: /Users/teradakousuke/Developer/creative-flow-studio

# 変更をコミット
git add components/Toast.tsx app/page.tsx docs/deployment-instructions-auth-fix.md
git commit -m "feat: Add Toast notification for better auth UX

- Replace confirm dialog with elegant toast notifications
- Add login action button in toast
- Improve user experience for authentication flow

Note: Backend NextAuth setup required for Cloud Run dev environment"

# プッシュ
git push origin feature/admin-dashboard-final
```

### 4.2 Cloud Build実行

Cloud Buildが自動実行されない場合:

```bash
# 手動でビルドをトリガー
gcloud builds submit \
  --config=infra/scripts/node-mirror/cloudbuild.yaml \
  --substitutions=_ENV=dev,_REGION=asia-northeast1 \
  --project=$PROJECT_ID
```

### 4.3 デプロイ後の検証

#### 検証1: Secret Managerからの環境変数取得確認

```bash
# Cloud Run ログで環境変数が正しく読み込まれているか確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=creative-flow-studio-dev AND textPayload:NEXTAUTH" \
  --limit=10 \
  --project=$PROJECT_ID \
  --format=json
```

#### 検証2: ログインフロー確認

1. ブラウザで https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/ を開く
2. ヘッダーの **「ログイン」** ボタンをクリック
3. Google OAuth画面にリダイレクトされることを確認
4. Googleアカウントでログイン
5. アプリにリダイレクトされ、ヘッダーに **「ログアウト」** ボタンが表示されることを確認

#### 検証3: セッション確認

```bash
# ブラウザの開発者ツール（Console）で実行
fetch('/api/auth/session')
  .then(r => r.json())
  .then(console.log)

// 期待される出力（ログイン後）:
// {
//   "user": {
//     "id": "user_123",
//     "email": "your-email@example.com",
//     "role": "USER"
//   },
//   "expires": "2025-12-31T23:59:59.000Z"
// }

// ログイン前:
// {}
```

#### 検証4: API呼び出し確認

```bash
# ブラウザコンソールで（ログイン後）
fetch('/api/gemini/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: 'こんにちは' })
})
  .then(r => r.json())
  .then(console.log)

// 期待される出力:
// { response: "こんにちは！..." }

// 401エラーが出ないことを確認
```

---

## トラブルシューティング

### 問題1: ログインボタンをクリックしても何も起こらない

**原因**: JavaScriptエラーまたはNextAuth設定ミス

**確認方法**:
```bash
# ブラウザの開発者ツール（Console）でエラーを確認
```

**解決策**:
1. `NEXTAUTH_URL` が正しいか確認
2. Google OAuth設定のRedirect URIを再確認
3. ブラウザのCookieをクリア

### 問題2: Google OAuth画面で「リダイレクトURIが一致しません」エラー

**原因**: Google Cloud ConsoleのAuthorized Redirect URIが未登録

**解決策**:
1. Google Cloud Console → **APIとサービス** → **認証情報**
2. OAuth 2.0クライアントIDを開く
3. **承認済みのリダイレクトURI** に以下を追加:
   ```
   https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/api/auth/callback/google
   ```
4. 保存

### 問題3: ログイン成功後も401エラーが続く

**原因**: セッションCookieが生成されていない

**確認方法**:
```bash
# ブラウザの開発者ツール → Application → Cookies で確認
# `next-auth.session-token` Cookieがあるか確認
```

**解決策**:
1. `NEXTAUTH_SECRET` が設定されているか確認
2. `NEXTAUTH_URL` がHTTPSであることを確認（HTTPはNG）
3. Cookieドメインが正しいか確認

### 問題4: Secret Managerからシークレットが読み込めない

**原因**: Cloud RunサービスアカウントにSecret Accessorロールが付与されていない

**確認方法**:
```bash
# IAMポリシーを確認
gcloud secrets get-iam-policy nextauth-secret --project=$PROJECT_ID
```

**解決策**:
```bash
# Secret Accessor ロールを付与
gcloud secrets add-iam-policy-binding nextauth-secret \
  --member="serviceAccount:cloud-run-runtime@dataanalyticsclinic.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID
```

---

## チェックリスト

### 設定前
- [ ] Google OAuth 2.0クライアントIDを作成済み
- [ ] Authorized Redirect URIを登録済み
- [ ] `NEXTAUTH_SECRET`を生成済み（`openssl rand -base64 32`）

### Secret Manager設定
- [ ] `nextauth-url` シークレット作成済み
- [ ] `nextauth-secret` シークレット作成済み
- [ ] `google-client-id` シークレット作成済み
- [ ] `google-client-secret` シークレット作成済み
- [ ] Cloud Run サービスアカウントにSecret Accessorロール付与済み

### Cloud Run設定
- [ ] Terraform設定更新済み（または手動でenv変数設定済み）
- [ ] `terraform apply` 実行済み（または手動デプロイ済み）

### デプロイと検証
- [ ] Claude Codeの修正をコミット・プッシュ済み
- [ ] Cloud Buildが成功している
- [ ] ログインボタンが機能する
- [ ] `/api/auth/session` が正しいレスポンスを返す
- [ ] APIが401エラーを返さない

---

## 参考資料

- [NextAuth.js Configuration](https://next-auth.js.org/configuration/options)
- [Google OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)
- [GCP Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Cloud Run Environment Variables](https://cloud.google.com/run/docs/configuring/environment-variables)

---

**完了後、Claude Codeへ検証結果を報告してください。**
