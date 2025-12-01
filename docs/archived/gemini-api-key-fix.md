# Gemini APIキー設定修正ガイド

**作成日**: 2025-11-30  
**問題**: Gemini APIが500エラーを返す  
**原因**: Cloud Runの環境変数にGEMINI_API_KEYが設定されていない

---

## 🔍 問題の詳細

### エラーメッセージ

```
/api/gemini/chat:1 Failed to load resource: the server responded with a status of 500 ()
Error: エラーが発生しました。もう一度お試しください。
```

### 原因

Cloud Runサービスの環境変数に`GEMINI_API_KEY`が設定されていません。

**確認結果**:
- Secret Managerには`gemini-api-key`が存在 ✅
- Cloud Runの環境変数に`GEMINI_API_KEY`が設定されていない ❌

---

## ✅ 解決方法

### 方法1: Terraformで設定（推奨）

Terraformの設定を確認して、`cloud_run_secret_env_vars`に`GEMINI_API_KEY`が含まれていることを確認します。

**設定ファイル**: `infra/envs/dev/terraform.tfvars`（存在する場合）または`infra/envs/dev/main.tf`のデフォルト値

**必要な設定**:
```hcl
cloud_run_secret_env_vars = {
  GEMINI_API_KEY = "gemini-api-key"
  # ... 他の環境変数
}
```

**Terraformを実行**:
```bash
cd infra/envs/dev
terraform plan
terraform apply
```

### 方法2: gcloudコマンドで直接設定（一時的）

```bash
gcloud run services update creative-flow-studio \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --update-secrets=GEMINI_API_KEY=gemini-api-key:latest
```

**注意**: Terraformで管理されているサービスなので、次回の`terraform apply`で上書きされる可能性があります。

---

## 📋 確認方法

### Cloud Runの環境変数を確認

```bash
gcloud run services describe creative-flow-studio \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --format="yaml(spec.template.spec.containers[0].env)" | \
  grep -A 3 "GEMINI"
```

### Secret Managerの値を確認

```bash
gcloud secrets versions access latest \
  --secret=gemini-api-key \
  --project=dataanalyticsclinic
```

---

## 🔗 関連ドキュメント

- `infra/envs/dev/terraform.tfvars.example` - Terraform設定の例
- `lib/gemini.ts` - Gemini APIサービスの実装

---

**修正日**: 2025-11-30  
**担当**: Claude Code



