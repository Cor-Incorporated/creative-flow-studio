locals {
  labels = {
    project     = var.project_id
    environment = var.environment
  }
}

module "network" {
  source = "../../modules/network"

  project_id   = var.project_id
  network_name = var.network_name
  region       = var.region
  environment  = var.environment
  subnet_cidr  = var.subnet_cidr
  connector_cidr = var.connector_cidr
}

resource "google_compute_global_address" "private_service_range" {
  name          = "${var.environment}-psa-range"
  project       = var.project_id
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = module.network.network_self_link
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = module.network.network_self_link
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_service_range.name]
}

module "cloud_sql" {
  source = "../../modules/cloud_sql"

  project_id        = var.project_id
  region            = var.region
  environment       = var.environment
  instance_name     = var.cloud_sql_instance_name
  tier              = var.cloud_sql_tier
  disk_size         = var.cloud_sql_disk_size_gb
  db_name           = var.cloud_sql_db_name
  db_user           = var.cloud_sql_user
  private_network   = module.network.network_self_link
  deletion_protection = false

  depends_on = [
    google_service_networking_connection.private_vpc_connection
  ]
}

module "secrets" {
  source = "../../modules/secrets"

  project_id          = var.project_id
  environment         = var.environment
  secret_values       = var.secret_values
  cloud_run_sa_email  = var.cloud_run_sa_email
}

resource "google_project_iam_member" "cloud_run_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${var.cloud_run_sa_email}"
}
