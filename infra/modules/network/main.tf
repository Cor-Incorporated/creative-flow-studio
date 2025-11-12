resource "google_compute_network" "this" {
  name                    = var.network_name
  project                 = var.project_id
  auto_create_subnetworks = false
  routing_mode            = "GLOBAL"
  description             = "Creative Flow Studio ${var.environment} VPC"
}

resource "google_compute_subnetwork" "primary" {
  name          = "${var.network_name}-${var.region}"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.this.id
  ip_cidr_range = var.subnet_cidr
  stack_type    = "IPV4_ONLY"

  private_ip_google_access = true
}

resource "google_vpc_access_connector" "serverless" {
  count        = var.create_serverless_connector ? 1 : 0
  name         = "${var.environment}-serverless-connector"
  project      = var.project_id
  region       = var.region
  network      = google_compute_network.this.name
  ip_cidr_range = var.connector_cidr

  min_throughput = var.connector_min_throughput
  max_throughput = var.connector_max_throughput

  provider = google-beta
}
