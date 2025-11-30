resource "google_sql_database_instance" "this" {
  name             = var.instance_name
  project          = var.project_id
  database_version = var.database_version
  region           = var.region

  settings {
    tier              = var.tier
    disk_size         = var.disk_size
    disk_autoresize   = var.disk_autoresize
    backup_configuration {
      enabled = var.backup_enabled
      location = var.region
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.private_network
      require_ssl     = true
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
  length  = 24
  special = true
}

resource "google_sql_user" "app" {
  name     = var.db_user
  project  = var.project_id
  instance = google_sql_database_instance.this.name
  password = random_password.db.result
}
