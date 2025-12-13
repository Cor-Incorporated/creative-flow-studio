resource "google_sql_database_instance" "this" {
  name             = var.instance_name
  project          = var.project_id
  database_version = var.database_version
  region           = var.region

  settings {
    tier            = var.tier
    disk_size       = var.disk_size
    disk_autoresize = var.disk_autoresize
    backup_configuration {
      enabled  = var.backup_enabled
      location = var.region
    }

    ip_configuration {
      ipv4_enabled    = var.ipv4_enabled
      private_network = var.private_network
      # SSL mode recommended over deprecated require_ssl
      ssl_mode = "ENCRYPTED_ONLY"

      # Allow Cloud Build to access Cloud SQL via public IP
      # Cloud Build uses dynamic IPs, so we need to allow Google Cloud's ranges
      dynamic "authorized_networks" {
        for_each = var.ipv4_enabled ? var.authorized_networks : []
        content {
          name  = authorized_networks.value.name
          value = authorized_networks.value.value
        }
      }
    }
  }

  deletion_protection = var.deletion_protection
}

resource "google_sql_database" "app" {
  name     = var.db_name
  project  = var.project_id
  instance = google_sql_database_instance.this.name
}

resource "random_password" "db" {
  length = 24
  # Disable special characters to avoid URL encoding issues in DATABASE_URL
  special = false
}

resource "google_sql_user" "app" {
  name     = var.db_user
  project  = var.project_id
  instance = google_sql_database_instance.this.name
  password = random_password.db.result
}
