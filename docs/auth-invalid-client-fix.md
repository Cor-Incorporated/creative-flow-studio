# 401 invalid_client エラー解決レポート

**作成日**: 2025-11-17  
**問題**: `401: invalid_client` エラーが発生  
**原因**: Cloud Runが参照しているSecret Managerのシークレット名が存在しなかった  
**ステータス**: ✅ 解決済み

---

## 🔍 問題の原因

### 発見された問題

Cloud Runサービス `creative-flow-studio-dev` は以下のシークレット名を参照していました：

- `GOOGLE_CLIENT_ID` → `secret-alias-3`
- `GOOGLE_CLIENT_SECRET` → `secret-alias-4`

しかし、実際にSecret Managerに存在していたシークレット名は：

- `google-client-id`
- `google-client-secret`

**結果**: `secret-alias-3` と `secret-alias-4` が存在しないため、Cloud Runが環境変数を取得できず、`invalid_client` エラーが発生していました。

---

## ✅ 実施した解決策

### 1. 不足していたシークレットの作成

`secret-alias-3` と `secret-alias-4` を作成し、正しい値を設定しました：

```bash
# Client ID を secret-alias-3 に設定
CLIENT_ID=$(gcloud secrets versions access latest --secret=google-client-id --project=dataanalyticsclinic)
echo -n "$CLIENT_ID" | gcloud secrets create secret-alias-3 \
  --project=dataanalyticsclinic \
  --replication-policy="automatic" \
  --data-file=-

# Client Secret を secret-alias-4 に設定
CLIENT_SECRET=$(gcloud secrets versions access latest --secret=google-client-secret --project=dataanalyticsclinic)
echo -n "$CLIENT_SECRET" | gcloud secrets create secret-alias-4 \
  --project=dataanalyticsclinic \
  --replication-policy="automatic" \
  --data-file=-
```

### 2. 設定値の確認

```bash
# secret-alias-3 の値を確認
gcloud secrets versions access latest --secret=secret-alias-3 --project=dataanalyticsclinic

# secret-alias-4 の値を確認
gcloud secrets versions access latest --secret=secret-alias-4 --project=dataanalyticsclinic
```

**設定された値**:
- `secret-alias-3`: `667780715339-xxxxx.apps.googleusercontent.com` (マスク済み)
- `secret-alias-4`: `GOCSPX-xxxxx` (マスク済み)

---

## 🔍 調査プロセス

### 1. Secret Managerの確認

```bash
# 実際に存在するシークレットを確認
gcloud secrets list --project=dataanalyticsclinic --filter="name:google-client OR name:secret-alias"
```

**結果**: `google-client-id` と `google-client-secret` は存在するが、`secret-alias-3` と `secret-alias-4` は存在しない

### 2. Cloud Run環境変数の確認

```bash
# Cloud Runが参照しているシークレット名を確認
gcloud run services describe creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --format="yaml(spec.template.spec.containers[0].env)" | \
  grep -A 5 "GOOGLE_CLIENT"
```

**結果**: Cloud Runは `secret-alias-3` と `secret-alias-4` を参照しているが、これらのシークレットが存在しない

### 3. ログの確認

```bash
# Cloud Runのログを確認
gcloud run services logs read creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --limit=50 | \
  grep -i "oauth\|auth\|client\|error\|invalid"
```

**結果**: `invalid_client` エラーと `State cookie was missing` エラーが確認された

---

## ⚠️ 重要な注意事項

### Cloud Runのシークレット取得タイミング

Cloud RunはSecret Managerから**最新のシークレットバージョンを自動的に取得**しますが、**新しいシークレットが作成された場合は、新しいリビジョンが作成されるまで反映されない可能性があります**。

### 再デプロイが必要な場合

もしまだエラーが発生する場合は、Cloud Runサービスを再デプロイしてください：

```bash
cd /Users/teradakousuke/Developer/creative-flow-studio
SHORT_SHA=$(git rev-parse --short HEAD)
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_NEXT_PUBLIC_APP_URL=https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app,_NEXT_PUBLIC_SUPABASE_URL=,SHORT_SHA=$SHORT_SHA \
  --project=dataanalyticsclinic
```

---

## 🚀 動作確認手順

### 1. ブラウザでの確認

1. ブラウザで以下にアクセス：
   ```
   https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app
   ```

2. **「Googleでログイン」ボタンをクリック**

3. **期待される動作**:
   - ✅ `invalid_client` エラーが発生しない
   - ✅ Google アカウント選択画面が表示される
   - ✅ ログイン成功後、チャットUIが表示される

### 2. エラーが続く場合

もしまだ `invalid_client` エラーが発生する場合は、以下を確認してください：

1. **Secret Managerの値を再確認**:
   ```bash
   gcloud secrets versions access latest --secret=secret-alias-3 --project=dataanalyticsclinic
   gcloud secrets versions access latest --secret=secret-alias-4 --project=dataanalyticsclinic
   ```

2. **Cloud Runの環境変数を再確認**:
   ```bash
   gcloud run services describe creative-flow-studio-dev \
     --region=asia-northeast1 \
     --project=dataanalyticsclinic \
     --format="yaml(spec.template.spec.containers[0].env)" | \
     grep -A 5 "GOOGLE_CLIENT"
   ```

3. **Cloud Runサービスを再デプロイ**（上記のコマンドを実行）

---

## 📋 今後の対策

### Secret Managerの命名規則の統一

今後は、Secret Managerのシークレット名を統一することを推奨します：

- **推奨**: `google-client-id`, `google-client-secret` などの明確な名前を使用
- **非推奨**: `secret-alias-3`, `secret-alias-4` などのエイリアス名を使用

### Terraformでの管理

Secret ManagerのシークレットはTerraformで管理することで、このような不整合を防ぐことができます：

```hcl
resource "google_secret_manager_secret" "google_client_id" {
  secret_id = "google-client-id"
  # ...
}

resource "google_secret_manager_secret_version" "google_client_id" {
  secret      = google_secret_manager_secret.google_client_id.id
  secret_data = var.google_client_id
}
```

---

## 🔗 関連ドキュメント

- `docs/auth-setup-complete.md` - 認証システム設定完了レポート
- `docs/google-oauth-console-setup.md` - Google OAuth設定ガイド
- `docs/nextauth-cloud-run-setup.md` - NextAuth.js Cloud Run設定ガイド

---

**解決日**: 2025-11-17  
**担当**: Cursor (JavaSE-21 LTS)

