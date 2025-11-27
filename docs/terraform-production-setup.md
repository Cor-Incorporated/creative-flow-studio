# Terraform 本番環境セットアップガイド

## 概要

このドキュメントでは、Creative Flow Studio の本番環境を Terraform で管理するための手順を説明します。

## 前提条件

- GCP プロジェクト: `dataanalyticsclinic`
- Terraform バージョン: 1.0 以上
- `gcloud` CLI がインストール済み
- Terraform サービスアカウントに必要な権限が付与済み

## 1. Terraform State Backend の設定

Terraform state は GCS バケットに保存されます。

```bash
cd infra/envs/dev

# Backend 設定（初回のみ）
terraform init \
  -backend-config="bucket=dataanalyticsclinic-terraform-state" \
  -backend-config="prefix=creative-flow-studio/dev"
```

## 2. terraform.tfvars の作成

`terraform.tfvars.example` をコピーして本番値を設定：

```bash
cp terraform.tfvars.example terraform.tfvars
```

### 必須設定項目

`terraform.tfvars` の以下の項目を本番値に更新：

```hcl
# プロジェクト設定（変更不要）
project_id  = "dataanalyticsclinic"
region      = "asia-northeast1"
environment = "dev"  # または "prod"

# Cloud Run 設定
cloud_run_env_vars = {
  NEXTAUTH_URL                      = "https://your-app-domain.com"
  NEXT_PUBLIC_APP_URL               = "https://your-app-domain.com"
  NEXT_PUBLIC_SUPABASE_URL          = "https://your-project.supabase.co"
  NEXT_PUBLIC_SUPABASE_ANON_KEY     = "eyJhbGc..."  # Supabase Dashboard から取得
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_live_..."  # Stripe Dashboard から取得
}

# Secret Manager の値（機密情報）
secret_values = {
  "nextauth-secret"        = "YOUR_GENERATED_SECRET"  # openssl rand -base64 32
  "google-client-id"       = "YOUR_GOOGLE_CLIENT_ID"
  "google-client-secret"   = "YOUR_GOOGLE_CLIENT_SECRET"
  "supabase-service-role"  = "YOUR_SUPABASE_SERVICE_ROLE_KEY"
  "stripe-secret-key"      = "sk_live_..."  # Stripe Dashboard から取得
  "stripe-webhook-secret"  = "whsec_..."    # Stripe Webhook 設定から取得
  "gemini-api-key"         = "YOUR_GEMINI_API_KEY"
  "supabase-anon-key"      = "YOUR_SUPABASE_ANON_KEY"
  "stripe-publishable-key" = "pk_live_..."
}
```

**重要:** `terraform.tfvars` は Git にコミットしないでください（`.gitignore` に追加済み）。

## 3. Cloud Run の既存リソースを Terraform にインポート

既に手動で作成した Cloud Run サービスがある場合、Terraform state にインポートします。

### 3.1 Cloud Run サービスの確認

```bash
gcloud run services describe creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --format="value(name)"
```

### 3.2 Terraform へのインポート

```bash
cd infra/envs/dev

# Cloud Run サービスをインポート
terraform import module.cloud_run.google_cloud_run_v2_service.this \
  projects/dataanalyticsclinic/locations/asia-northeast1/services/creative-flow-studio-dev

# Artifact Registry リポジトリをインポート（存在する場合）
terraform import module.cloud_run.google_artifact_registry_repository.this \
  projects/dataanalyticsclinic/locations/asia-northeast1/repositories/creative-flow-studio

# Cloud SQL インスタンスをインポート（存在する場合）
terraform import module.cloud_sql.google_sql_database_instance.this \
  dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql
```

### 3.3 インポート後の確認

```bash
# Terraform plan を実行して差分を確認
terraform plan

# 差分がなければ apply を実行
terraform apply
```

## 4. Secret Manager の設定

Secret Manager のシークレットは Terraform で管理されます。

### 4.1 既存シークレットの確認

```bash
gcloud secrets list --project=dataanalyticsclinic
```

### 4.2 シークレットの更新

`terraform.tfvars` の `secret_values` を更新してから：

```bash
terraform apply
```

これにより、Secret Manager のシークレットバージョンが更新されます。

### 4.3 手動でシークレットを更新する場合

```bash
# 例: Stripe Secret Key を更新
echo -n "sk_live_YOUR_KEY" | gcloud secrets versions add stripe-secret-key \
  --project=dataanalyticsclinic \
  --data-file=-
```

**注意:** 手動で更新した場合、次回の `terraform apply` で上書きされる可能性があります。

## 5. Cloud Build トリガーの設定

Cloud Build トリガーの substitutions を更新：

```bash
gcloud builds triggers update YOUR_TRIGGER_NAME \
  --region=asia-northeast1 \
  --substitutions=_NEXT_PUBLIC_APP_URL=https://your-app-domain.com,_NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
```

## 6. デプロイフロー

### 6.1 初回デプロイ

```bash
cd infra/envs/dev

# Terraform でインフラを構築
terraform init
terraform plan
terraform apply

# Cloud Build でアプリケーションをデプロイ
gcloud builds submit --config=../../cloudbuild.yaml
```

### 6.2 継続的デプロイ

GitHub への push で Cloud Build トリガーが自動実行されます。

## 7. トラブルシューティング

### Secret Manager の権限エラー

```
Error: Error creating SecretVersion: Permission denied
```

**解決策:** Terraform サービスアカウントに `roles/secretmanager.admin` を付与：

```bash
gcloud projects add-iam-policy-binding dataanalyticsclinic \
  --member="serviceAccount:terraform@dataanalyticsclinic.iam.gserviceaccount.com" \
  --role="roles/secretmanager.admin"
```

### Cloud Run の接続エラー

Cloud SQL への接続が失敗する場合：

1. VPC Connector が正しく設定されているか確認
2. Cloud Run サービスアカウントに `roles/cloudsql.client` が付与されているか確認
3. Cloud SQL インスタンスの Private IP が正しく設定されているか確認

## 8. 関連ドキュメント

- `infra/README.md` - インフラモジュールの詳細
- `docs/interface-spec.md` - 環境変数仕様
- `docs/stripe-integration-plan.md` - Stripe 統合設定


