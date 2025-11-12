output "instance_connection_name" {
  value       = google_sql_database_instance.this.connection_name
  description = "Cloud SQL 接続名"
}

output "instance_self_link" {
  value       = google_sql_database_instance.this.self_link
  description = "Cloud SQL インスタンス self_link"
}

output "database_name" {
  value       = google_sql_database.app.name
  description = "アプリケーション DB 名"
}

output "database_user" {
  value       = google_sql_user.app.name
  description = "アプリケーション DB ユーザー"
}

output "database_password" {
  value       = random_password.db.result
  description = "アプリケーション DB パスワード"
  sensitive   = true
}
