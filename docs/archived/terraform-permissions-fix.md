# Terraform権限エラー修正レポート

**作成日**: 2025-11-30  
**問題**: VPC Access Connectorへのアクセス権限エラー  
**ステータス**: ✅ 修正完了

---

## 🔍 問題の詳細

### エラーメッセージ

```
Permission 'vpcaccess.connectors.get' denied for the resource 
projects/dataanalyticsclinic/locations/asia-northeast1/connectors/dev-serverless-connector
```

### 原因

Terraformサービスアカウント（`terraform@dataanalyticsclinic.iam.gserviceaccount.com`）に、VPC Access Connectorを管理するための権限が不足していました。

---

## ✅ 実施した修正

### VPC Access Connector権限の付与

```bash
gcloud projects add-iam-policy-binding dataanalyticsclinic \
  --member="serviceAccount:terraform@dataanalyticsclinic.iam.gserviceaccount.com" \
  --role="roles/vpcaccess.user"
```

**結果**: ✅ 権限が正常に付与されました

---

## 📋 Terraformサービスアカウントの現在の権限

以下のロールが付与されています：

- ✅ `roles/vpcaccess.user` - VPC Access Connectorの管理
- ✅ `roles/cloudsql.admin` - Cloud SQLの管理
- ✅ `roles/compute.networkAdmin` - ネットワークの管理
- ✅ `roles/run.admin` - Cloud Runの管理
- ✅ `roles/secretmanager.admin` - Secret Managerの管理
- ✅ `roles/storage.admin` - Cloud Storageの管理
- ✅ `roles/iam.serviceAccountAdmin` - サービスアカウントの管理
- ✅ `roles/resourcemanager.projectIamAdmin` - IAMポリシーの管理
- ✅ `roles/serviceusage.serviceUsageAdmin` - サービス使用の管理
- ✅ `roles/logging.admin` - ロギングの管理
- ✅ `roles/monitoring.admin` - モニタリングの管理

---

## 🔍 確認方法

### GitHub Actionsの確認

1. 以下のURLでワークフローの実行状況を確認:
   ```
   https://github.com/Cor-Incorporated/creative-flow-studio/actions
   ```

2. "Terraform Deploy" ワークフローを確認
3. 最新の実行が成功していることを確認

### 権限の確認

```bash
# Terraformサービスアカウントの権限を確認
gcloud projects get-iam-policy dataanalyticsclinic \
  --flatten="bindings[].members" \
  --format="table(bindings.role)" \
  --filter="bindings.members:terraform@dataanalyticsclinic.iam.gserviceaccount.com"
```

---

## ⚠️ よくある問題

### 権限が反映されない

**原因**: IAMポリシーの変更が反映されるまで数分かかる場合があります。

**解決策**: 
1. 数分待ってから再実行
2. 権限が正しく付与されているか再確認

### 他のリソースへのアクセスエラー

**原因**: 他のリソース（Cloud SQL、Cloud Runなど）への権限が不足している可能性があります。

**解決策**: 必要なロールを追加で付与:
```bash
gcloud projects add-iam-policy-binding dataanalyticsclinic \
  --member="serviceAccount:terraform@dataanalyticsclinic.iam.gserviceaccount.com" \
  --role="ROLE_NAME"
```

---

## 🔗 関連ドキュメント

- [VPC Access Connector IAM Roles](https://cloud.google.com/vpc/docs/configure-serverless-vpc-access#required-permissions)
- [Terraform Google Provider - VPC Access Connector](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/vpc_access_connector)

---

**修正完了日**: 2025-11-30  
**担当**: Claude Code



