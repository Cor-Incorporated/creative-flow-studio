# Stripe Terraform設定ガイド

**最終更新:** 2025-12-01  
**目的:** TerraformとSecret ManagerにStripe環境変数を設定して、CI/CDで自動デプロイできるようにする

---

## 📋 現在の状況

### ✅ 完了済み
1. Stripeプラン作成（PRO/ENTERPRISE）
2. データベースにPrice ID設定
3. Secret ManagerにStripeキー設定（手動）

### ⚠️ 必要な作業
1. Terraformの`terraform.tfvars`にStripeキーを設定
2. Terraformで`terraform apply`を実行
3. Cloud Runサービスの環境変数設定を確認

---

## 🔧 Terraform設定

### 1. `terraform.tfvars`の確認・作成

`infra/envs/dev/terraform.tfvars`が存在するか確認：

```bash
cd infra/envs/dev
ls -la terraform.tfvars
```

存在しない場合は、`terraform.tfvars.example`をコピー：

```bash
cp terraform.tfvars.example terraform.tfvars
```

### 2. Stripeキーを設定

`.env.local`からStripeキーを取得：

```bash
# .env.localからStripeキーを確認
grep STRIPE .env.local
```

`terraform.tfvars`の`secret_values`セクションを更新：

```hcl
secret_values = {
  # ... 既存の設定 ...
  
  # Stripeキー（.env.localから取得した値）
  # 注意: 実際のキーは.env.localから取得してください
  "stripe-secret-key"      = "sk_test_CHANGE_ME_FROM_ENV_LOCAL"
  "stripe-webhook-secret"  = "whsec_CHANGE_ME_FROM_ENV_LOCAL"
  "stripe-publishable-key" = "pk_test_CHANGE_ME_FROM_ENV_LOCAL"
}
```

**重要:** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`は`cloud_run_secret_env_vars`でSecret Managerから参照されます（直接設定ではありません）。

### 3. Terraformを適用

```bash
cd infra/envs/dev

# Terraformを初期化（初回のみ）
terraform init \
  -backend-config="bucket=dataanalyticsclinic-terraform-state" \
  -backend-config="prefix=creative-flow-studio/dev"

# 変更内容を確認
terraform plan

# 適用
terraform apply
```

**重要:** `terraform apply`を実行すると、Secret Managerの既存の値が`terraform.tfvars`の値で上書きされます。

---

## 🔄 CI/CDパイプラインの動作

### Cloud Buildの設定（`cloudbuild.yaml`）

Cloud Buildは以下のように動作します：

1. **ビルド時:**
   - Secret Managerから`stripe-secret-key`, `stripe-webhook-secret`, `stripe-publishable-key`を読み込み
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`をビルド引数として渡す

2. **デプロイ時:**
   - `gcloud run deploy`でコンテナイメージをデプロイ
   - **環境変数とSecret Managerの参照はTerraformで管理**

### デプロイフロー

```
Git Push (devブランチ)
  ↓
Cloud Build Trigger
  ↓
1. npm install
2. Prisma generate
3. Prisma migrate deploy
4. Docker build (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEYをビルド引数として)
5. Push to Artifact Registry
6. Deploy to Cloud Run
   - 環境変数: Terraformで設定された値を使用
   - Secret Manager参照: Terraformで設定されたSecretを参照
```

---

## ⚠️ 重要な注意事項

### 1. Secret Managerの管理方法

現在、2つの方法でSecret Managerを管理しています：

- **手動設定:** `setup-stripe-secrets.sh`で直接Secret Managerに設定
- **Terraform管理:** `terraform.tfvars`の`secret_values`で管理

**推奨:** Terraformで一元管理することを推奨します。

### 2. `terraform apply`の影響

`terraform apply`を実行すると：
- Secret Managerの既存の値が`terraform.tfvars`の値で上書きされる
- Cloud Runサービスの環境変数設定が更新される

### 3. Cloud Runの環境変数設定

Cloud Runの環境変数は2つの方法で設定されます：

1. **直接設定（`cloud_run_env_vars`）:**
   - `NEXTAUTH_URL`
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`（公開可能なため直接設定）

2. **Secret Manager参照（`cloud_run_secret_env_vars`）:**
   - `STRIPE_SECRET_KEY` → `stripe-secret-key:latest`
   - `STRIPE_WEBHOOK_SECRET` → `stripe-webhook-secret:latest`
   - その他の機密情報

---

## 🚀 セットアップ手順

### ステップ1: Terraform設定を更新

```bash
cd infra/envs/dev

# terraform.tfvarsを編集
# 1. secret_valuesにStripeキーを設定
# 2. cloud_run_env_varsにNEXT_PUBLIC_STRIPE_PUBLISHABLE_KEYを設定
```

### ステップ2: Terraformを適用

```bash
terraform plan
terraform apply
```

### ステップ3: 確認

```bash
# Cloud Runサービスの環境変数を確認
gcloud run services describe creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --format="yaml(spec.template.spec.containers[0].env)"
```

### ステップ4: PRを作成してマージ

```bash
# ブランチを作成
git checkout -b feature/stripe-terraform-setup

# 変更をコミット
git add infra/envs/dev/terraform.tfvars
git commit -m "feat: Add Stripe keys to Terraform configuration"

# PRを作成
git push origin feature/stripe-terraform-setup
```

PRをマージすると、Cloud Buildが自動的に実行され、新しい設定でデプロイされます。

---

## 🔍 トラブルシューティング

### Secret Managerの値が上書きされない

`terraform apply`を実行してもSecret Managerの値が更新されない場合：

```bash
# Terraformの状態を確認
terraform state list | grep secret

# 手動でSecret Managerを更新
./scripts/setup-stripe-secrets.sh
```

### Cloud Runの環境変数が反映されない

Cloud Buildでデプロイ後、環境変数が反映されない場合：

```bash
# Terraformで再適用
cd infra/envs/dev
terraform apply

# または、手動で更新
./scripts/update-cloud-run-stripe.sh
```

---

## 📚 関連ドキュメント

- [Stripe クラウド開発環境セットアップガイド](./stripe-cloud-dev-setup.md)
- [Terraform 本番環境セットアップガイド](./terraform-production-setup.md)
- [Cloud Build 設定](./cloud-build-migration-setup.md)




