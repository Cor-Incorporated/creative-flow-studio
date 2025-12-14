#!/bin/bash
# Secret ManagerにStripeキーを設定するスクリプト
# Usage: ./scripts/setup-stripe-secrets.sh
# .env.localからStripeキーを読み込んでSecret Managerに設定します

set -e

PROJECT_ID="dataanalyticsclinic"
ENV_FILE=".env.local"

echo "🚀 Stripe Secret Manager設定スクリプト"
echo "================================"

# .env.localファイルの存在確認
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

# Secret Managerに設定
echo "🔐 Secret ManagerにStripeキーを設定中..."

# Stripe Secret Key
echo "  - stripe-secret-key を更新中..."
echo -n "$STRIPE_SECRET_KEY" | \
  gcloud secrets versions add stripe-secret-key \
  --project=$PROJECT_ID \
  --data-file=- \
  --quiet

# Stripe Publishable Key
echo "  - stripe-publishable-key を更新中..."
echo -n "$STRIPE_PUBLISHABLE_KEY" | \
  gcloud secrets versions add stripe-publishable-key \
  --project=$PROJECT_ID \
  --data-file=- \
  --quiet

# Stripe Webhook Secret
echo "  - stripe-webhook-secret を更新中..."
echo -n "$STRIPE_WEBHOOK_SECRET" | \
  gcloud secrets versions add stripe-webhook-secret \
  --project=$PROJECT_ID \
  --data-file=- \
  --quiet

echo ""
echo "✅ Secret Managerへの設定が完了しました！"
echo ""
echo "次のステップ:"
echo "  ./scripts/update-cloud-run-stripe.sh"




