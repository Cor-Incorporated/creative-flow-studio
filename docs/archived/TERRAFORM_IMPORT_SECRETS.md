# Terraform: 既存のSecret ManagerのSecretをインポート

既存のSecret ManagerのSecretをTerraformで管理するために、インポートが必要です。

## 手順

1. すべてのSecretをインポート:

```bash
cd infra/envs/dev

# 各Secretをインポート
terraform import 'module.secrets.google_secret_manager_secret.managed["database-url"]' projects/dataanalyticsclinic/secrets/database-url
terraform import 'module.secrets.google_secret_manager_secret.managed["nextauth-secret"]' projects/dataanalyticsclinic/secrets/nextauth-secret
terraform import 'module.secrets.google_secret_manager_secret.managed["google-client-id"]' projects/dataanalyticsclinic/secrets/google-client-id
terraform import 'module.secrets.google_secret_manager_secret.managed["google-client-secret"]' projects/dataanalyticsclinic/secrets/google-client-secret
terraform import 'module.secrets.google_secret_manager_secret.managed["supabase-service-role"]' projects/dataanalyticsclinic/secrets/supabase-service-role
terraform import 'module.secrets.google_secret_manager_secret.managed["supabase-anon-key"]' projects/dataanalyticsclinic/secrets/supabase-anon-key
terraform import 'module.secrets.google_secret_manager_secret.managed["stripe-secret-key"]' projects/dataanalyticsclinic/secrets/stripe-secret-key
terraform import 'module.secrets.google_secret_manager_secret.managed["stripe-webhook-secret"]' projects/dataanalyticsclinic/secrets/stripe-webhook-secret
terraform import 'module.secrets.google_secret_manager_secret.managed["stripe-publishable-key"]' projects/dataanalyticsclinic/secrets/stripe-publishable-key
terraform import 'module.secrets.google_secret_manager_secret.managed["gemini-api-key"]' projects/dataanalyticsclinic/secrets/gemini-api-key
```

2. terraform planで確認:

```bash
terraform plan
```

3. terraform applyで適用:

```bash
terraform apply
```

## 注意事項

- `secret_values`からStripeキーを削除したため、Terraformは既存のSecret Managerの値を上書きしません
- 既存のSecret Managerの値が保持されます
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`は`cloud_run_secret_env_vars`でSecret Managerから参照されます




