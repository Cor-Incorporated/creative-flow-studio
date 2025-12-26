#!/bin/bash
# Terraform用のStripe設定を準備するスクリプト
# Usage: ./scripts/prepare-stripe-terraform.sh
# .env.localからStripeキーを読み込んで、terraform.tfvarsの更新内容を表示

set -e

ENV_FILE=".env.local"
TFVARS_EXAMPLE="infra/envs/dev/terraform.tfvars.example"
TFVARS="infra/envs/dev/terraform.tfvars"

echo "🚀 Stripe Terraform設定準備スクリプト"
echo "================================"

# .env.localの存在確認
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ エラー: $ENV_FILE が見つかりません"
    exit 1
fi

# .env.localからStripeキーを読み込む
echo "📖 .env.localからStripeキーを読み込み中..."
STRIPE_SECRET_KEY=$(grep "^STRIPE_SECRET_KEY=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"')
STRIPE_PUBLISHABLE_KEY=$(grep "^NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"')
STRIPE_WEBHOOK_SECRET=$(grep "^STRIPE_WEBHOOK_SECRET=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"')

if [ -z "$STRIPE_SECRET_KEY" ] || [ -z "$STRIPE_PUBLISHABLE_KEY" ] || [ -z "$STRIPE_WEBHOOK_SECRET" ]; then
    echo "❌ エラー: .env.localにStripeキーが設定されていません"
    exit 1
fi

echo "✅ Stripeキーを読み込みました"
echo ""

# terraform.tfvarsの存在確認
if [ ! -f "$TFVARS" ]; then
    echo "📝 terraform.tfvarsが存在しません。terraform.tfvars.exampleから作成します..."
    cp "$TFVARS_EXAMPLE" "$TFVARS"
    echo "✅ terraform.tfvarsを作成しました"
    echo ""
fi

echo "📝 terraform.tfvarsの更新内容:"
echo ""
echo "1. secret_valuesセクションに以下を追加/更新:"
echo ""
echo "   \"stripe-secret-key\"      = \"$STRIPE_SECRET_KEY\""
echo "   \"stripe-webhook-secret\"  = \"$STRIPE_WEBHOOK_SECRET\""
echo "   \"stripe-publishable-key\" = \"$STRIPE_PUBLISHABLE_KEY\""
echo ""
echo "2. cloud_run_env_varsセクションに以下を追加/更新:"
echo ""
echo "   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = \"$STRIPE_PUBLISHABLE_KEY\""
echo "   NEXTAUTH_URL                      = \"https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app\""
echo "   NEXT_PUBLIC_APP_URL               = \"https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app\""
echo ""
echo "次のステップ:"
echo "1. infra/envs/dev/terraform.tfvars を編集して上記の値を設定"
echo "2. terraform plan で変更内容を確認"
echo "3. terraform apply で適用"
echo ""
echo "⚠️  注意: terraform applyを実行すると、Secret Managerの既存の値が上書きされます"





