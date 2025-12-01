# Terraform VPC Access Connector修正レポート

**作成日**: 2025-11-30  
**問題**: 既存のVPC Access Connectorへのアクセス権限エラー  
**ステータス**: ✅ 修正完了

---

## 🔍 問題の詳細

### エラーメッセージ

```
Permission 'vpcaccess.connectors.get' denied for the resource 
projects/dataanalyticsclinic/locations/asia-northeast1/connectors/dev-serverless-connector
```

### 原因

1. **既存のVPC Access Connectorが存在**: `dev-serverless-connector`が既に存在していた
2. **Terraformが既存リソースを読み取ろうとしていた**: `create_serverless_connector = true`（デフォルト）のため、新しいConnectorを作成しようとしていたが、既存のConnectorを読み取る必要があった
3. **権限不足**: 初期状態では`vpcaccess.connectors.get`権限が不足していた

---

## ✅ 実施した修正

### 1. VPC Access Connector権限の付与

以下のロールをTerraformサービスアカウントに付与：

```bash
# Viewer権限（読み取り）
gcloud projects add-iam-policy-binding dataanalyticsclinic \
  --member="serviceAccount:terraform@dataanalyticsclinic.iam.gserviceaccount.com" \
  --role="roles/vpcaccess.viewer"

# User権限（基本操作）
gcloud projects add-iam-policy-binding dataanalyticsclinic \
  --member="serviceAccount:terraform@dataanalyticsclinic.iam.gserviceaccount.com" \
  --role="roles/vpcaccess.user"

# Admin権限（完全な管理）
gcloud projects add-iam-policy-binding dataanalyticsclinic \
  --member="serviceAccount:terraform@dataanalyticsclinic.iam.gserviceaccount.com" \
  --role="roles/vpcaccess.admin"
```

### 2. Terraform設定の変更

既存のVPC Access Connectorを使用するように設定を変更：

**変更内容**:
- `infra/envs/dev/variables.tf`に`create_serverless_connector`変数を追加（デフォルト: `false`）
- `infra/envs/dev/main.tf`の`vpc_connector`ロジックを更新して、既存のConnectorを参照するように変更

**変更後の動作**:
- `create_serverless_connector = false`の場合: 既存の`dev-serverless-connector`を使用
- `create_serverless_connector = true`の場合: 新しいConnectorを作成

---

## 📋 現在の設定

### VPC Access Connector

- **既存のConnector**: `dev-serverless-connector`
- **状態**: `READY`
- **ネットワーク**: `creative-flow-studio-vpc`
- **CIDR**: `10.8.0.0/28`

### Terraform設定

```hcl
variable "create_serverless_connector" {
  description = "Serverless VPC Access Connector を作成するか（既存のConnectorを使用する場合は false）"
  type        = bool
  default     = false
}
```

---

## 🔍 確認方法

### GitHub Actionsの確認

1. 以下のURLでワークフローの実行状況を確認:
   ```
   https://github.com/Cor-Incorporated/creative-flow-studio/actions
   ```

2. "Terraform Deploy" ワークフローを確認
3. 最新の実行が成功していることを確認

### 既存Connectorの確認

```bash
gcloud compute networks vpc-access connectors list \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic
```

---

## ⚠️ 今後の注意事項

### 既存ConnectorをTerraformで管理する場合

既存のConnectorをTerraformの状態にインポートする場合：

```bash
cd infra/envs/dev
terraform import \
  module.network.google_vpc_access_connector.serverless[0] \
  projects/dataanalyticsclinic/locations/asia-northeast1/connectors/dev-serverless-connector
```

その後、`create_serverless_connector = true`に設定して、Terraformで管理できます。

### 新しいConnectorを作成する場合

`create_serverless_connector = true`に設定すると、新しいConnectorが作成されます。既存のConnectorと競合しないように、名前やCIDRを変更する必要があります。

---

## 🔗 関連ドキュメント

- [VPC Access Connector Documentation](https://cloud.google.com/vpc/docs/configure-serverless-vpc-access)
- [Terraform Google Provider - VPC Access Connector](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/vpc_access_connector)

---

**修正完了日**: 2025-11-30  
**担当**: Claude Code



