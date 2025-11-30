#!/bin/bash
# 既存のSecret ManagerのSecretをTerraformのstateにインポートするスクリプト
# Usage: ./scripts/import-secrets-to-terraform.sh

set -e

PROJECT_ID="dataanalyticsclinic"
SECRETS=(
    "database-url"
    "nextauth-secret"
    "google-client-id"
    "google-client-secret"
    "supabase-service-role"
    "supabase-anon-key"
    "stripe-secret-key"
    "stripe-webhook-secret"
    "stripe-publishable-key"
    "gemini-api-key"
)

cd infra/envs/dev

echo "🚀 Secret ManagerのSecretをTerraformにインポート中..."
echo "================================"

for secret in "${SECRETS[@]}"; do
    echo ""
    echo "📝 Importing: $secret"
    terraform import "module.secrets.google_secret_manager_secret.managed[\"$secret\"]" "projects/$PROJECT_ID/secrets/$secret" 2>&1 | grep -E "(Import prepared|Error|already)" || echo "  ✅ Imported or already exists"
done

echo ""
echo "✅ インポートが完了しました"
echo ""
echo "次のステップ: terraform plan で変更内容を確認"
