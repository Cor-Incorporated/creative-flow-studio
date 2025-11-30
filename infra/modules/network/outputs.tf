output "network_self_link" {
  value       = google_compute_network.this.self_link
  description = "VPC ネットワーク self_link"
}

output "subnet_self_link" {
  value       = google_compute_subnetwork.primary.self_link
  description = "サブネット self_link"
}

output "subnet_name" {
  value       = google_compute_subnetwork.primary.name
  description = "サブネット名"
}

output "connector_name" {
  value       = var.create_serverless_connector ? google_vpc_access_connector.serverless[0].name : null
  description = "Serverless VPC Access Connector 名 (存在する場合)"
}

output "network_name" {
  value       = google_compute_network.this.name
  description = "VPC ネットワーク名"
}
