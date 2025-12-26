#!/bin/bash
# Stripe CLIでPRO/ENTERPRISEプランを作成するスクリプト
# Usage: ./scripts/setup-stripe-plans.sh
# Requirements: stripe CLI, jq

set -e

# 依存関係チェック
if ! command -v stripe &> /dev/null; then
    echo "❌ エラー: Stripe CLIがインストールされていません"
    echo "   インストール: https://stripe.com/docs/stripe-cli"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "❌ エラー: jqがインストールされていません"
    echo "   macOS: brew install jq"
    echo "   Linux: apt-get install jq または yum install jq"
    exit 1
fi

echo "🚀 Stripeプラン作成スクリプト"
echo "================================"

# PROプラン（¥3,000/月）の作成
echo ""
echo "📦 PROプラン（¥3,000/月）を作成中..."
PRODUCT_PRO=$(stripe products create \
  --name "BlunaAI PRO" \
  --description "PROプラン - 月額¥3,000")

PRO_PRODUCT_ID=$(echo "$PRODUCT_PRO" | jq -r '.id')
echo "✅ PRO Product ID: $PRO_PRODUCT_ID"

PRICE_PRO=$(stripe prices create \
  --product "$PRO_PRODUCT_ID" \
  --unit-amount 3000 \
  --currency jpy \
  -d "recurring[interval]=month")

PRO_PRICE_ID=$(echo "$PRICE_PRO" | jq -r '.id')
echo "✅ PRO Price ID: $PRO_PRICE_ID"

# ENTERPRISEプラン（¥30,000/月）の作成
echo ""
echo "📦 ENTERPRISEプラン（¥30,000/月）を作成中..."
PRODUCT_ENTERPRISE=$(stripe products create \
  --name "BlunaAI ENTERPRISE" \
  --description "ENTERPRISEプラン - 月額¥30,000")

ENTERPRISE_PRODUCT_ID=$(echo "$PRODUCT_ENTERPRISE" | jq -r '.id')
echo "✅ ENTERPRISE Product ID: $ENTERPRISE_PRODUCT_ID"

PRICE_ENTERPRISE=$(stripe prices create \
  --product "$ENTERPRISE_PRODUCT_ID" \
  --unit-amount 30000 \
  --currency jpy \
  -d "recurring[interval]=month")

ENTERPRISE_PRICE_ID=$(echo "$PRICE_ENTERPRISE" | jq -r '.id')
echo "✅ ENTERPRISE Price ID: $ENTERPRISE_PRICE_ID"

# 結果を表示
echo ""
echo "================================"
echo "✅ プラン作成完了"
echo ""
echo "PROプラン:"
echo "  Product ID: $PRO_PRODUCT_ID"
echo "  Price ID: $PRO_PRICE_ID"
echo ""
echo "ENTERPRISEプラン:"
echo "  Product ID: $ENTERPRISE_PRODUCT_ID"
echo "  Price ID: $ENTERPRISE_PRICE_ID"
echo ""
echo "次のステップ:"
echo "1. データベースにPrice IDを設定: ./scripts/set-stripe-price-ids.sh $PRO_PRICE_ID $ENTERPRISE_PRICE_ID"
echo "2. Secret ManagerにStripeキーを設定: ./scripts/setup-stripe-secrets.sh"
echo "3. Cloud Runサービスを更新: ./scripts/update-cloud-run-stripe.sh"
echo ""
echo "Price IDを環境変数にエクスポート:"
echo "export PRO_PRICE_ID=$PRO_PRICE_ID"
echo "export ENTERPRISE_PRICE_ID=$ENTERPRISE_PRICE_ID"
