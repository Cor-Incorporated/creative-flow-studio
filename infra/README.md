# Infra Stack

このディレクトリは GCP 上で BlunaAI の Next.js フルスタック環境を構築する Terraform 定義を格納します。基本方針は以下の通りです。

- **バックエンド**: GCS バケット `dataanalyticsclinic-terraform-state` に remote state を保存。
- **環境**: まずは `envs/dev` を Cloud Run ステージング（ブランチ `dev`）向けに構築。将来的に `prod` などを追加する想定。
- **モジュール**: `modules/` 以下に VPC/ネットワーク、Cloud SQL、Secret Manager 等を分割し、各環境から再利用。
- **サービスアカウント**: 既存の `cloud-run-runtime@dataanalyticsclinic.iam.gserviceaccount.com` と `terraform@dataanalyticsclinic.iam.gserviceaccount.com` を前提にロール付与を管理。

## フォルダ構成

```
infra/
├── README.md
├── envs/
│   └── dev/
│       ├── backend.tf          # GCS remote state
│       ├── main.tf             # モジュール呼び出しとスタック定義
│       ├── providers.tf        # google プロバイダ設定
│       ├── variables.tf        # 環境変数
│       ├── outputs.tf
│       └── terraform.tfvars.example
└── modules/
    ├── network/                # VPC/サブネット/Serverless Connector
    ├── cloud_sql/              # Cloud SQL インスタンス + DB + ユーザー
    ├── secrets/                # Secret Manager シークレットと IAM
    └── cloud_run/              # Artifact Registry + Cloud Run サービス + 環境変数
```

## 事前準備

1. `gcloud auth application-default login` で `dataanalyticsclinic` プロジェクトに紐付いた ADC を取得。
2. Terraform >= 1.6 をインストール。
3. 初回のみ state バケットにアクセスできるよう対象ユーザー/SA に権限を付与。

## 使い方（dev 環境）

```bash
cd infra/envs/dev
terraform init \
  -backend-config="bucket=dataanalyticsclinic-terraform-state" \
  -backend-config="prefix=terraform/dev/state"

cp terraform.tfvars.example terraform.tfvars
# 必要な値を編集（特に secret_values と CIDR）

terraform plan
terraform apply
```

state バケットと prefix はドキュメントに合わせて調整してください。

### Secret Manager への値投入

- `terraform.tfvars` の `secret_values` マップは、Secret Manager 上の `database-url` などのシークレットを自動的に作成し、同名の最新バージョンへ値を登録します。
- 配布されている `.example` にはダミー値を入れているため、**apply 前に必ず実値へ置き換えてください**。置き換え忘れるとダミーが本番 Secret として保存されます。
- すでに手動で作成済みの Secret がある場合は `terraform import google_secret_manager_secret.managed["<secret-id>"] <resource-name>` を実行し、`secret_values` にも同じキーを定義してください。

### Private Service Connect / Serverless Connector

- `envs/dev/main.tf` では VPC Peering (`google_compute_global_address` + `google_service_networking_connection`) を作成し、Cloud SQL Private IP の必須前提を満たしています。`psa_address` / `psa_prefix_length` で Service Networking 用レンジを制御できるので、**/24 程度の未使用ブロック** を指定してください。/16 など大きすぎるレンジは推奨されません。
- Serverless VPC Access Connector には /28 CIDR が必要なため、`connector_cidr` 変数で重複しないレンジ（例: `10.8.0.0/28`）を指定します。VPC 内の他 CIDR と重ならないよう注意してください。

## Cloud Run / Artifact Registry モジュール

- `modules/cloud_run/` では Artifact Registry の Docker リポジトリ、Cloud Run サービス本体、`roles/run.invoker` の公開設定を一括で管理します。
- `cloud_run_env_vars` / `cloud_run_secret_env_vars` で `.env` と同じ名前の環境変数を指定でき、Secret Manager の `secret_id`（例: `database-url`）を Cloud Run の環境変数（例: `DATABASE_URL`）へマッピングします。
- VPC 接続が必要な場合は、`network` モジュールで作成した Serverless Connector 名を自動で参照し、`cloud_sql_instances` へ `module.cloud_sql.instance_connection_name` を渡すことで `/cloudsql` マウントを構成します。
- Cloud Build から Artifact Registry に push された `asia-northeast1-docker.pkg.dev/<project>/<repo>/app:latest` イメージを `cloud_run_image` に指定してください（初期はダミーで OK）。

### 既存 Artifact Registry との統合

- すでに `asia-northeast1` に同名リポジトリがある場合は、apply 前に import してください。
    ```bash
    terraform import \
      module.cloud_run.google_artifact_registry_repository.this \
      projects/<project>/locations/asia-northeast1/repositories/<repo>
    ```
- もしくは `artifact_repo_id` を既存名に合わせた上で import 完了までは `terraform plan/apply` を実行しないでください。現状 create フラグは無いため、import していないと 409 エラーになります。

## 今後の TODO

- 監視/ログ/アラート用モジュール
- CI/CD 用 service account/key rotation のコード化
