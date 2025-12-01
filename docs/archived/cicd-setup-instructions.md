# CI/CDパイプライン設定手順

**最終更新**: 2025-11-30  
**目的**: developブランチへのpushでTerraformを自動適用

---

## 📋 前提条件

1. GitHubリポジトリにアクセス権限がある
2. GCPプロジェクトにアクセス権限がある
3. Terraformサービスアカウントが設定されている

---

## 🔧 設定手順

### 1. GitHub Secretsの設定

GitHubリポジトリのSettings → Secrets and variables → Actionsで以下を設定:

#### オプションA: Workload Identity Federation（推奨）

```
WIF_PROVIDER: projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID
WIF_SERVICE_ACCOUNT: terraform@dataanalyticsclinic.iam.gserviceaccount.com
```

#### オプションB: サービスアカウントキー（簡易）

```
GCP_SA_KEY: (TerraformサービスアカウントのJSONキー)
```

### 2. Cloud Buildトリガーの設定（オプション）

GitHubリポジトリがCloud Buildに接続されている場合:

```bash
gcloud builds triggers create github \
  --name="terraform-deploy-develop" \
  --repo-name="creative-flow-studio" \
  --repo-owner="Cor-Incorporated" \
  --branch-pattern="^develop$" \
  --build-config="cloudbuild-terraform.yaml" \
  --project=dataanalyticsclinic \
  --region=asia-northeast1
```

**注意**: GitHubリポジトリがCloud Buildに接続されていない場合は、GitHub Actionsを使用してください。

---

## 🚀 使用方法

### Terraformでインフラを更新

1. `infra/envs/dev/`ディレクトリで変更を加える
2. `develop`ブランチにpush:
   ```bash
   git checkout develop
   git add infra/
   git commit -m "chore: Update Terraform configuration"
   git push origin develop
   ```
3. GitHub ActionsまたはCloud Buildが自動的にTerraformを実行

### 手動でTerraformを実行

```bash
cd infra/envs/dev
terraform init
terraform plan
terraform apply
```

---

## 📝 動作確認

### GitHub Actionsの確認

1. GitHubリポジトリのActionsタブを開く
2. "Terraform Deploy"ワークフローが表示されることを確認
3. `develop`ブランチにpushして実行を確認

### Cloud Buildの確認

1. GCP ConsoleのCloud Buildページを開く
2. トリガー一覧で`terraform-deploy-develop`が表示されることを確認
3. `develop`ブランチにpushして実行を確認

---

## ⚠️ トラブルシューティング

### GitHub Actionsが失敗する場合

1. **認証エラー**: GitHub Secretsが正しく設定されているか確認
2. **Terraformエラー**: `infra/envs/dev/`ディレクトリの設定を確認
3. **権限エラー**: Terraformサービスアカウントに必要な権限が付与されているか確認

### Cloud Buildが失敗する場合

1. **トリガーが作成されない**: GitHubリポジトリがCloud Buildに接続されているか確認
2. **認証エラー**: サービスアカウントの権限を確認

---

## 🔗 関連ドキュメント

- `docs/cicd-setup-complete.md` - 設定完了レポート
- `.github/workflows/terraform-deploy.yml` - GitHub Actionsワークフロー
- `cloudbuild-terraform.yaml` - Cloud Build設定

---

**作成日**: 2025-11-30  
**担当**: Claude Code



