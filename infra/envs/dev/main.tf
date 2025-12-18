locals {
  labels = {
    project     = var.project_id
    environment = var.environment
  }

  # Terraformで作成したConnectorを使用する場合
  vpc_connector = module.network.connector_name == null ? null : "projects/${var.project_id}/locations/${var.region}/connectors/${module.network.connector_name}"
}

module "network" {
  source = "../../modules/network"

  project_id                  = var.project_id
  network_name                = var.network_name
  region                      = var.region
  environment                 = var.environment
  subnet_cidr                 = var.subnet_cidr
  connector_cidr              = var.connector_cidr
  create_serverless_connector = var.create_serverless_connector
}

resource "google_compute_global_address" "private_service_range" {
  name          = "${var.environment}-psa-range"
  project       = var.project_id
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  address       = var.psa_address
  prefix_length = var.psa_prefix_length
  network       = module.network.network_self_link
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = module.network.network_self_link
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_service_range.name]
}

module "cloud_sql" {
  source = "../../modules/cloud_sql"

  project_id          = var.project_id
  region              = var.region
  environment         = var.environment
  instance_name       = var.cloud_sql_instance_name
  tier                = var.cloud_sql_tier
  disk_size           = var.cloud_sql_disk_size_gb
  db_name             = var.cloud_sql_db_name
  db_user             = var.cloud_sql_user
  private_network     = module.network.network_self_link
  deletion_protection = false

  # Enable public IP for Cloud Build migrations (dev environment only)
  ipv4_enabled = true
  authorized_networks = [
    {
      name  = "cloud-build"
      value = "0.0.0.0/0" # Cloud Build uses dynamic IPs; restrict in prod
    }
  ]

  depends_on = [
    google_service_networking_connection.private_vpc_connection
  ]
}

locals {
  secret_values_final = merge(
    var.secret_values,
    {
      "database-url" = format(
        "postgresql://%s:%s@/%s?host=/cloudsql/%s",
        var.cloud_sql_user,
        module.cloud_sql.database_password,
        var.cloud_sql_db_name,
        module.cloud_sql.instance_connection_name
      )
    }
  )
}

module "secrets" {
  source = "../../modules/secrets"

  project_id                      = var.project_id
  environment                     = var.environment
  secret_values                   = local.secret_values_final
  cloud_run_sa_email              = var.cloud_run_sa_email
  cloud_build_sa_email            = var.cloud_build_sa_email
  cloud_build_service_agent_email = var.cloud_build_service_agent_email
}

locals {
  cloud_run_secret_env = {
    for env_name, secret_id in var.cloud_run_secret_env_vars :
    env_name => module.secrets.secret_names[secret_id]
  }
}

resource "google_project_iam_member" "cloud_run_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${var.cloud_run_sa_email}"
}

module "cloud_run" {
  source = "../../modules/cloud_run"

  project_id            = var.project_id
  region                = var.region
  service_name          = var.cloud_run_service_name
  service_account_email = var.cloud_run_sa_email
  artifact_repo_id      = var.artifact_repo_id
  container_image       = var.cloud_run_image
  container_port        = var.cloud_run_port
  container_cpu         = var.cloud_run_cpu
  container_memory      = var.cloud_run_memory
  timeout_seconds       = var.cloud_run_timeout_seconds
  concurrency           = var.cloud_run_concurrency
  min_instances         = var.cloud_run_min_instances
  max_instances         = var.cloud_run_max_instances
  ingress               = var.cloud_run_ingress
  allow_unauthenticated = var.cloud_run_allow_unauthenticated
  env_vars              = var.cloud_run_env_vars
  secret_env_vars       = local.cloud_run_secret_env
  cloud_sql_instances   = [module.cloud_sql.instance_connection_name]
  vpc_connector         = local.vpc_connector
  # Cloud SQL connectivity requires the Cloud SQL connector IP (not in RFC1918).
  # Using ALL_TRAFFIC can force connector traffic through the VPC and break Cloud SQL.
  # Prefer private-ranges-only to keep Google-managed service traffic reachable.
  vpc_egress = "PRIVATE_RANGES_ONLY"
  labels     = local.labels

  depends_on = [module.secrets]
}
