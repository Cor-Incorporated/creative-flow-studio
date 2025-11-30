variable "project_id" {
  type        = string
  description = "GCP プロジェクト ID"
}

variable "environment" {
  type        = string
  description = "環境識別子"
}

variable "replication_location" {
  type        = string
  description = "Secret Manager のレプリケーションロケーション"
  default     = "asia-northeast1"
}

variable "secret_values" {
  type        = map(string)
  description = "秘密情報の値 (secret_id => value)。未指定のキーは version を作成しない"
  default     = {}
}

variable "cloud_run_sa_email" {
  type        = string
  description = "Secret へアクセスする Cloud Run サービスアカウント"
  default     = ""
}

variable "cloud_build_sa_email" {
  type        = string
  description = "Secret へアクセスする Cloud Build サービスアカウント"
  default     = ""
}

variable "cloud_build_service_agent_email" {
  type        = string
  description = "Secret へアクセスする Cloud Build サービスエージェント"
  default     = ""
}
