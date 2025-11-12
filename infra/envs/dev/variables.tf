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

variable "secret_values" {
  description = <<EOT
Secret Manager に投入する値のマップ。
キーは `secrets` モジュールで定義した secret_id（例: database-url）。
値は base64 ではなくプレーンテキスト。
EOT
  type    = map(string)
  default = {}
}
