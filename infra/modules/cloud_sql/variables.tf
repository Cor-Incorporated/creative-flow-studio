variable "project_id" {
  type        = string
  description = "GCP プロジェクト ID"
}

variable "region" {
  type        = string
  description = "Cloud SQL リージョン"
}

variable "environment" {
  type        = string
  description = "環境識別子"
}

variable "instance_name" {
  type        = string
  description = "Cloud SQL インスタンス名"
}

variable "database_version" {
  type        = string
  default     = "POSTGRES_14"
  description = "Cloud SQL の DB バージョン"
}

variable "tier" {
  type        = string
  description = "マシンタイル (例: db-f1-micro)"
}

variable "disk_size" {
  type        = number
  description = "ディスクサイズ (GB)"
}

variable "db_name" {
  type        = string
  description = "作成するデータベース名"
}

variable "db_user" {
  type        = string
  description = "アプリケーションユーザー名"
}

variable "private_network" {
  type        = string
  description = "プライベート IP 用の VPC self_link"
  default     = null
}

variable "backup_enabled" {
  type        = bool
  description = "自動バックアップを有効化するか"
  default     = true
}

variable "pitrecovery_enabled" {
  type        = bool
  description = "Point-in-time Recovery を有効化するか"
  default     = false
}

variable "disk_autoresize" {
  type        = bool
  description = "ディスク自動拡張を有効化するか"
  default     = true
}

variable "deletion_protection" {
  type        = bool
  description = "削除保護を有効にするか"
  default     = false
}

variable "ipv4_enabled" {
  type        = bool
  description = "パブリックIPアドレスを有効化するか（ローカル開発やマイグレーション用）"
  default     = false
}

variable "authorized_networks" {
  type = list(object({
    name  = string
    value = string
  }))
  description = "パブリックIP経由で接続を許可するネットワーク（Cloud Build等）"
  default     = []
}
