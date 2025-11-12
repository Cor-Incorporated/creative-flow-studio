output "network" {
  description = "VPC ネットワーク情報"
  value = {
    name          = module.network.network_name
    subnet_name   = module.network.subnet_name
    connector     = module.network.connector_name
    subnet_self   = module.network.subnet_self_link
    network_self  = module.network.network_self_link
  }
}

output "cloud_sql" {
  description = "Cloud SQL 接続情報"
  value = {
    instance_connection_name = module.cloud_sql.instance_connection_name
    database_name            = module.cloud_sql.database_name
    database_user            = module.cloud_sql.database_user
    database_password        = module.cloud_sql.database_password
  }
  sensitive = true
}

output "secret_names" {
  description = "Secret Manager に作成した secret ID とフルネーム"
  value       = module.secrets.secret_names
}

output "cloud_run" {
  description = "Cloud Run / Artifact Registry 情報"
  value = {
    service_name = module.cloud_run.service_name
    service_uri  = module.cloud_run.service_uri
    artifact_repo = module.cloud_run.artifact_repo
  }
}
