locals {
  managed_secrets = {
    "database-url"           = "Cloud SQL 接続文字列"
    "nextauth-secret"        = "NextAuth.js セッションキー"
    "google-client-id"       = "Google OAuth Client ID"
    "google-client-secret"   = "Google OAuth Client Secret"
    "supabase-service-role"  = "Supabase Service Role Key"
    "stripe-secret-key"      = "Stripe Secret Key"
    "stripe-webhook-secret"  = "Stripe Webhook Secret"
    "gemini-api-key"         = "Google Gemini API Key"
  }
}

resource "google_secret_manager_secret" "managed" {
  for_each = local.managed_secrets

  project   = var.project_id
  secret_id = each.key

  labels = {
    environment = var.environment
  }

  replication {
    user_managed {
      replicas {
        location = var.replication_location
      }
    }
  }
}

resource "google_secret_manager_secret_version" "current" {
  for_each = { for key, value in var.secret_values : key => value if contains(keys(local.managed_secrets), key) }

  secret      = google_secret_manager_secret.managed[each.key].id
  secret_data = each.value

depends_on = [google_secret_manager_secret.managed]
}

resource "google_secret_manager_secret_iam_member" "cloud_run" {
  for_each = var.cloud_run_sa_email == "" ? {} : google_secret_manager_secret.managed

  project  = var.project_id
  secret_id = each.value.secret_id
  role     = "roles/secretmanager.secretAccessor"
  member   = "serviceAccount:${var.cloud_run_sa_email}"
}
