output "service_uri" {
  value       = google_cloud_run_v2_service.this.uri
  description = "Cloud Run サービス URI"
}

output "artifact_repo" {
  value       = google_artifact_registry_repository.this.id
  description = "Artifact Registry repository name"
}

output "service_name" {
  value = google_cloud_run_v2_service.this.name
}
