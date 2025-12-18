# CI/CDパイプライン設定完了レポート

**作成日**: 2025-11-30  
**目的**: developブランチへのpushでTerraformを自動適用  
**ステータス**: ✅ 設定完了

---

## 🔍 設定内容

### 1. Cloud Buildトリガー

**トリガー名**: `terraform-deploy-develop`  
**対象ブランチ**: `develop`  
**ビルド設定ファイル**: `cloudbuild-terraform.yaml`

**動作**:
- `develop`ブランチにpushされると自動的にトリガー
- Terraformの`init`、`plan`、`apply`を実行
- Cloud Runサービスの設定を更新

### 2. GitHub Actionsワークフロー

**ファイル**: `.github/workflows/terraform-deploy.yml`

**動作**:
- `develop`ブランチへのpushで実行
- `infra/**`ディレクトリの変更を検知
- Terraformを実行してインフラを更新

---

## 📝 使用方法

### Terraformでインフラを更新する場合

1. `infra/envs/dev/`ディレクトリで変更を加える
2. `develop`ブランチにpush:
   ```bash
   git checkout develop
   git add infra/
   git commit -m "chore: Update Terraform configuration"
   git push origin develop
   ```
3. Cloud BuildまたはGitHub Actionsが自動的にTerraformを実行

### 手動でTerraformを実行する場合

```bash
cd infra/envs/dev
terraform init
terraform plan
terraform apply
```

---

## ⚠️ 注意事項

1. **Terraformサービスアカウントの権限**:
   - `terraform@dataanalyticsclinic.iam.gserviceaccount.com`に必要な権限が付与されていることを確認

2. **状態ファイルの管理**:
   - Terraformの状態は`gs://dataanalyticsclinic-terraform-state`に保存されます
   - 手動で変更を加えないでください

3. **Secret Managerの更新**:
   - Secret Managerの値はTerraformで管理されます
   - 手動で更新した場合、次回の`terraform apply`で上書きされる可能性があります

---

## 🔗 関連ファイル

- `cloudbuild-terraform.yaml` - Cloud Buildのビルド設定
- `.github/workflows/terraform-deploy.yml` - GitHub Actionsワークフロー
- `infra/envs/dev/main.tf` - Terraformのメイン設定

---

**設定完了日**: 2025-11-30  
**担当**: Claude Code



