variable "project_id" {
  description = "GCP プロジェクト ID"
  type        = string
  default     = "dataanalyticsclinic"
}

variable "region" {
  description = "主要リージョン"
  type        = string
  default     = "asia-northeast1"
}

variable "environment" {
  description = "環境識別子 (例: dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "network_name" {
  description = "VPC ネットワーク名"
  type        = string
  default     = "creative-flow-studio-vpc"
}

variable "subnet_cidr" {
  description = "asia-northeast1 サブネットの CIDR"
  type        = string
  default     = "10.10.0.0/20"
}

variable "connector_cidr" {
  description = "Serverless VPC Access Connector 用の /28 CIDR"
  type        = string
  default     = "10.8.0.0/28"
}

variable "psa_address" {
  description = "Private Service Connect (Service Networking) 用の開始アドレス"
  type        = string
  default     = "10.9.0.0"
}

variable "psa_prefix_length" {
  description = "Private Service Connect 用のプレフィックス長 (/24 推奨)"
  type        = number
  default     = 24
}

variable "cloud_sql_instance_name" {
  description = "Cloud SQL インスタンス名"
  type        = string
  default     = "creative-flow-studio-sql"
}

variable "cloud_sql_tier" {
  description = "Cloud SQL マシンタイル"
  type        = string
  default     = "db-f1-micro"
}

variable "cloud_sql_disk_size_gb" {
  description = "ディスクサイズ (GB)"
  type        = number
  default     = 20
}

variable "cloud_sql_user" {
  description = "アプリで使用する DB ユーザー"
  type        = string
  default     = "app_user"
}

variable "cloud_sql_db_name" {
  description = "アプリで使用するデータベース名"
  type        = string
  default     = "creative_flow_studio"
}

variable "cloud_run_sa_email" {
  description = "Cloud Run 実行用サービスアカウント"
  type        = string
  default     = "cloud-run-runtime@dataanalyticsclinic.iam.gserviceaccount.com"
}

variable "cloud_run_service_name" {
  description = "Cloud Run サービス名"
  type        = string
  default     = "creative-flow-studio"
}

variable "artifact_repo_id" {
  description = "Artifact Registry リポジトリID"
  type        = string
  default     = "creative-flow-studio"
}

variable "cloud_run_image" {
  description = "デプロイに使用するコンテナイメージ"
  type        = string
  default     = "asia-northeast1-docker.pkg.dev/dataanalyticsclinic/creative-flow-studio/app:latest"
}

variable "cloud_run_port" {
  description = "Cloud Run コンテナポート"
  type        = number
  default     = 8080
}

variable "cloud_run_cpu" {
  description = "Cloud Run CPU リミット"
  type        = string
  default     = "1"
}

variable "cloud_run_memory" {
  description = "Cloud Run メモリリミット"
  type        = string
  default     = "1Gi"
}

variable "cloud_run_timeout_seconds" {
  description = "リクエストタイムアウト"
  type        = number
  default     = 300
}

variable "cloud_run_concurrency" {
  description = "1 インスタンスあたりの同時リクエスト数"
  type        = number
  default     = 80
}

variable "cloud_run_min_instances" {
  description = "最小インスタンス数"
  type        = number
  default     = 0
}

variable "cloud_run_max_instances" {
  description = "最大インスタンス数"
  type        = number
  default     = 5
}

variable "cloud_run_ingress" {
  description = "INGRESS_TRAFFIC_* 設定"
  type        = string
  default     = "INGRESS_TRAFFIC_ALL"
}

variable "cloud_run_allow_unauthenticated" {
  description = "すべてのユーザーに公開するか"
  type        = bool
  default     = true
}

variable "cloud_run_env_vars" {
  description = "平文の環境変数"
  type        = map(string)
  default     = {}
}

variable "cloud_run_secret_env_vars" {
  description = "Secret Manager を参照する環境変数 (ENV_NAME => secret_id)"
  type        = map(string)
  default     = {}
}

variable "secret_values" {
  description = <<EOT
Secret Manager に投入する値のマップ。
キーは `secrets` モジュールで定義した secret_id（例: database-url）。
値は base64 ではなくプレーンテキスト。
EOT
  type    = map(string)
  default = {}
}
