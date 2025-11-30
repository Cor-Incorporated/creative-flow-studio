output "secret_names" {
  description = "Secret Manager secret_id -> resource name"
  value = {
    for key, secret in google_secret_manager_secret.managed :
    key => secret.name
  }
}
