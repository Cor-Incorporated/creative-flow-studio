variable "project_id" {
  type        = string
  description = "GCP プロジェクト ID"
}

variable "network_name" {
  type        = string
  description = "作成する VPC ネットワーク名"
}

variable "environment" {
  type        = string
  description = "環境識別子 (dev/staging/prod)"
}

variable "region" {
  type        = string
  description = "サブネットおよびコネクタを配置するリージョン"
}

variable "subnet_cidr" {
  type        = string
  description = "サブネットの CIDR ブロック"
}

variable "create_serverless_connector" {
  type        = bool
  description = "Serverless VPC Access Connector を作成するか"
  default     = true
}

variable "connector_min_throughput" {
  type        = number
  description = "Serverless VPC Access Connector の最小スループット (Mbps)"
  default     = 200
}

variable "connector_max_throughput" {
  type        = number
  description = "Serverless VPC Access Connector の最大スループット (Mbps)"
  default     = 300
}

variable "connector_cidr" {
  type        = string
  description = "Serverless VPC Access Connector 用の /28 CIDR ブロック (例: 10.8.0.0/28)"
  default     = "10.8.0.0/28"
}
