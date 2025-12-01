#!/bin/bash
# Cloud Runサービスを更新してStripeシークレットを最新バージョンに設定
# Usage: ./scripts/update-cloud-run-stripe.sh

set -e

PROJECT_ID="dataanalyticsclinic"
REGION="asia-northeast1"
SERVICE_NAME="creative-flow-studio-dev"

echo "🚀 Cloud Run Stripe設定更新スクリプト"
echo "================================"

echo "📝 Cloud Runサービスを更新中..."
gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --update-secrets=STRIPE_SECRET_KEY=stripe-secret-key:latest,STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest,NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=stripe-publishable-key:latest \
  --quiet

echo ""
echo "✅ Cloud Runサービスの更新が完了しました！"
echo ""
echo "サービスURL: https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app"
echo "本番ドメイン: https://blunaai.com"
echo ""
echo "次のステップ:"
echo "  プランの契約・切り替えをテスト: ./scripts/test-stripe-subscription.sh"



