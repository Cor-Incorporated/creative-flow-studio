variable "project_id" {
  type        = string
  description = "GCP プロジェクト ID"
}

variable "region" {
  type        = string
  description = "Cloud Run / Artifact Registry を配置するリージョン"
}

variable "service_name" {
  type        = string
  description = "Cloud Run サービス名"
}

variable "service_account_email" {
  type        = string
  description = "Cloud Run 実行用サービスアカウント"
}

variable "artifact_repo_id" {
  type        = string
  description = "Artifact Registry のリポジトリ ID"
}

variable "artifact_repo_format" {
  type        = string
  description = "Artifact Registry フォーマット"
  default     = "DOCKER"
}

variable "container_image" {
  type        = string
  description = "デプロイするコンテナイメージ (例: asia-northeast1-docker.pkg.dev/<project>/<repo>/app:latest)"
}

variable "container_port" {
  type        = number
  description = "コンテナの公開ポート"
  default     = 8080
}

variable "container_cpu" {
  type        = string
  description = "CPU リミット (例: \"1\")"
  default     = "1"
}

variable "container_memory" {
  type        = string
  description = "メモリリミット (例: \"512Mi\")"
  default     = "512Mi"
}

variable "timeout_seconds" {
  type        = number
  description = "リクエストタイムアウト"
  default     = 300
}

variable "concurrency" {
  type        = number
  description = "1 インスタンスあたりの同時リクエスト数"
  default     = 80
}

variable "min_instances" {
  type        = number
  description = "最小インスタンス数"
  default     = 0
}

variable "max_instances" {
  type        = number
  description = "最大インスタンス数"
  default     = 3
}

variable "ingress" {
  type        = string
  description = "INGRESS_TRAFFIC_ALL 等"
  default     = "INGRESS_TRAFFIC_ALL"
}

variable "allow_unauthenticated" {
  type        = bool
  description = "すべてのユーザーに公開するか"
  default     = true
}

variable "env_vars" {
  type        = map(string)
  description = "平文の環境変数"
  default     = {}
}

variable "secret_env_vars" {
  type        = map(string)
  description = "Secret Manager のフルリソース名 (projects/.../secrets/...) を参照する環境変数 (ENV_NAME => secret_name)"
  default     = {}
}

variable "cloud_sql_instances" {
  type        = list(string)
  description = "Cloud SQL インスタンス接続名のリスト"
  default     = []
}

variable "vpc_connector" {
  type        = string
  description = "Serverless VPC Access Connector のフルリソース名 (projects/.../connectors/...)"
  default     = null
}

variable "vpc_egress" {
  type        = string
  description = "VPC egress 設定 (ALL_TRAFFIC など)"
  default     = "ALL_TRAFFIC"
}

variable "labels" {
  type        = map(string)
  description = "Cloud Run サービスに付与するラベル"
  default     = {}
}
