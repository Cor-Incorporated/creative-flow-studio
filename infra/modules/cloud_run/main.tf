resource "google_artifact_registry_repository" "this" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_repo_id
  format        = var.artifact_repo_format
  # Note: Keep original description for consistency
  description = "Creative Flow Studio container images"
}

resource "google_cloud_run_v2_service" "this" {
  name     = var.service_name
  project  = var.project_id
  location = var.region
  ingress  = var.ingress
  labels   = var.labels

  lifecycle {
    # CI/CD (Cloud Build) is the source of truth for container image updates.
    # Without this, a Terraform apply can unintentionally roll the service back
    # to a pinned/default image (e.g. :latest), causing drift and outages.
    ignore_changes = [
      template[0].containers[0].image
    ]
  }

  template {
    service_account                  = var.service_account_email
    timeout                          = "${var.timeout_seconds}s"
    max_instance_request_concurrency = var.concurrency

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    dynamic "vpc_access" {
      for_each = var.vpc_connector == null ? [] : [var.vpc_connector]
      content {
        connector = vpc_access.value
        egress    = var.vpc_egress
      }
    }

    dynamic "volumes" {
      for_each = length(var.cloud_sql_instances) > 0 ? [1] : []
      content {
        name = "cloudsql"
        cloud_sql_instance {
          instances = var.cloud_sql_instances
        }
      }
    }

    containers {
      image = var.container_image

      ports {
        container_port = var.container_port
      }

      resources {
        limits = {
          cpu    = var.container_cpu
          memory = var.container_memory
        }
      }

      dynamic "env" {
        for_each = var.env_vars
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.secret_env_vars
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }

      dynamic "volume_mounts" {
        for_each = length(var.cloud_sql_instances) > 0 ? [1] : []
        content {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
      }
    }
  }

  traffic {
    percent  = 100
    type     = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    revision = null
  }
}

resource "google_cloud_run_v2_service_iam_member" "unauth" {
  count = var.allow_unauthenticated ? 1 : 0

  name   = google_cloud_run_v2_service.this.name
  role   = "roles/run.invoker"
  member = "allUsers"
}
