# PR作成前チェックリスト - Stripe統合

**ブランチ:** `feature/stripe-cloud-dev-setup` → `dev`  
**目的:** Stripe CLIとgcloudコマンドでクラウド開発環境をセットアップ

---

## ✅ 完了済み項目

### 1. Stripeプラン作成
- [x] PROプラン（¥3,000/月）作成: `price_1SZHWfPMiKkgsj8ExlTCuPcB`
- [x] ENTERPRISEプラン（¥30,000/月）作成: `price_1SZHWgPMiKkgsj8EGodNTHmR`
- [x] データベースにPrice ID設定

### 2. Secret Manager設定
- [x] `stripe-secret-key`: version 5
- [x] `stripe-webhook-secret`: version 6
- [x] `stripe-publishable-key`: version 3

### 3. Terraform設定
- [x] `terraform.tfvars`にStripeキーを設定
- [x] `cloud_run_env_vars`に`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`を設定

### 4. スクリプト作成
- [x] `setup-stripe-plans.sh` - Stripeプラン作成
- [x] `set-stripe-price-ids.sh` - データベースにPrice ID設定
- [x] `setup-stripe-secrets.sh` - Secret Manager設定
- [x] `update-cloud-run-stripe.sh` - Cloud Run更新
- [x] `test-stripe-subscription.sh` - プラン契約・切り替えテスト
- [x] `prepare-stripe-terraform.sh` - Terraform設定準備

### 5. ドキュメント作成
- [x] `docs/stripe-cloud-dev-setup.md` - セットアップガイド
- [x] `docs/stripe-terraform-setup.md` - Terraform設定ガイド
- [x] `scripts/QUICKSTART.md` - クイックスタート

---

## ⚠️ PR作成前に確認すべき項目

### 1. Terraformの適用

**重要:** `terraform.tfvars`にStripeキーを設定しましたが、`terraform apply`を実行する必要があります。

```bash
cd infra/envs/dev

# 変更内容を確認
terraform plan

# 適用（Secret ManagerとCloud Runの環境変数が更新されます）
terraform apply
```

**注意:** `terraform apply`を実行すると：
- Secret Managerの既存の値が`terraform.tfvars`の値で上書きされます
- Cloud Runサービスの環境変数設定が更新されます

### 2. コミット内容の確認

以下のファイルがコミット対象に含まれているか確認：

```bash
git status
```

**コミットすべきファイル:**
- `scripts/setup-stripe-plans.sh`
- `scripts/set-stripe-price-ids.sh`
- `scripts/setup-stripe-secrets.sh`
- `scripts/update-cloud-run-stripe.sh`
- `scripts/test-stripe-subscription.sh`
- `scripts/prepare-stripe-terraform.sh`
- `docs/stripe-cloud-dev-setup.md`
- `docs/stripe-terraform-setup.md`
- `scripts/QUICKSTART.md`
- `docs/PR_CHECKLIST.md`（このファイル）

**コミットしてはいけないファイル:**
- `infra/envs/dev/terraform.tfvars`（`.gitignore`に含まれているため自動的に除外されます）
- `.env.local`

### 3. Cloud Buildの動作確認

PRをマージすると、Cloud Buildが自動的に実行されます：

1. **ビルド時:**
   - Secret Managerから`stripe-secret-key`, `stripe-webhook-secret`, `stripe-publishable-key`を読み込み
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`をビルド引数として渡す

2. **デプロイ時:**
   - `gcloud run deploy`でコンテナイメージをデプロイ
   - **環境変数とSecret Managerの参照はTerraformで管理**

**重要:** Cloud Buildのデプロイステップでは環境変数を明示的に設定していないため、Terraformで設定した環境変数が使用されます。

---

## 🚀 PR作成手順

### ステップ1: ブランチを作成

```bash
git checkout -b feature/stripe-cloud-dev-setup
```

### ステップ2: 変更をコミット

```bash
# スクリプトとドキュメントを追加
git add scripts/setup-stripe-plans.sh
git add scripts/set-stripe-price-ids.sh
git add scripts/setup-stripe-secrets.sh
git add scripts/update-cloud-run-stripe.sh
git add scripts/test-stripe-subscription.sh
git add scripts/prepare-stripe-terraform.sh
git add docs/stripe-cloud-dev-setup.md
git add docs/stripe-terraform-setup.md
git add scripts/QUICKSTART.md
git add docs/PR_CHECKLIST.md

# コミット
git commit -m "feat: Add Stripe cloud dev environment setup scripts and documentation

- Add Stripe CLI scripts for creating plans and managing subscriptions
- Add scripts for setting up Secret Manager and Cloud Run
- Add comprehensive documentation for Stripe integration
- Support FREE/PRO/ENTERPRISE plan testing in cloud dev environment"
```

### ステップ3: PRを作成

```bash
git push origin feature/stripe-cloud-dev-setup
```

GitHubでPRを作成し、以下を記載：

**タイトル:**
```
feat: Add Stripe cloud dev environment setup
```

**説明:**
```markdown
## 概要
Stripe CLIとgcloudコマンドを使って、クラウド開発環境でFREE/PRO/ENTERPRISEプランの契約・切り替えをテストできるようにしました。

## 変更内容
- Stripe CLIでプラン作成スクリプト（`setup-stripe-plans.sh`）
- データベースにPrice ID設定スクリプト（`set-stripe-price-ids.sh`）
- Secret Manager設定スクリプト（`setup-stripe-secrets.sh`）
- Cloud Run更新スクリプト（`update-cloud-run-stripe.sh`）
- プラン契約・切り替えテストスクリプト（`test-stripe-subscription.sh`）
- 包括的なドキュメント（`docs/stripe-cloud-dev-setup.md`）

## テスト済み
- ✅ Stripeプラン作成（PRO: ¥3,000/月、ENTERPRISE: ¥30,000/月）
- ✅ データベースにPrice ID設定
- ✅ Secret ManagerにStripeキー設定
- ✅ Cloud Runサービス更新

## 注意事項
- `terraform.tfvars`にStripeキーを設定済み（`.gitignore`に含まれているためコミットされません）
- PRマージ前に`terraform apply`を実行する必要があります
- Cloud Buildでデプロイ後、Terraformで設定した環境変数が使用されます
```

---

## 🔍 マージ後の確認事項

PRをマージした後、以下を確認：

### 1. Cloud Buildの実行確認

```bash
# Cloud Buildの実行履歴を確認
gcloud builds list \
  --project=dataanalyticsclinic \
  --limit=5
```

### 2. Cloud Runサービスの環境変数確認

```bash
gcloud run services describe creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --format="yaml(spec.template.spec.containers[0].env)"
```

### 3. Stripeの動作確認

1. アプリにアクセス: https://blunaai.com
2. `/pricing`ページでプランが表示されるか確認
3. PRO/ENTERPRISEプランの購入フローをテスト

---

## 📚 関連ドキュメント

- [Stripe クラウド開発環境セットアップガイド](./stripe-cloud-dev-setup.md)
- [Stripe Terraform設定ガイド](./stripe-terraform-setup.md)
- [クイックスタート](../scripts/QUICKSTART.md)
