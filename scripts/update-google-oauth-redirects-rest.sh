#!/bin/bash
# Google OAuth リダイレクトURI更新スクリプト（REST API使用）
# 両方のURL（Cloud Run URLとカスタムドメイン）をリダイレクトURIに追加

set -euo pipefail

PROJECT_ID="dataanalyticsclinic"
CLOUD_RUN_URL="https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app"
CUSTOM_DOMAIN="https://blunaai.com"
CLIENT_ID="667780715339-45a76cdu34shn8rnqqn7fvr9682v1bcg.apps.googleusercontent.com"

echo "🔍 Google OAuth クライアントIDを確認しています..."
echo "✅ Client ID: ${CLIENT_ID:0:30}..."
echo ""

# Access tokenを取得
echo "🔑 アクセストークンを取得しています..."
ACCESS_TOKEN=$(gcloud auth print-access-token 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ アクセストークンの取得に失敗しました"
    exit 1
fi

echo "📋 現在のOAuth 2.0クライアント設定を取得しています..."

# OAuth 2.0クライアントの設定を取得
OAUTH_CONFIG=$(curl -s \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://iam.googleapis.com/v1/projects/${PROJECT_ID}/oauthClients/${CLIENT_ID}" 2>/dev/null || echo "")

if [ -z "$OAUTH_CONFIG" ]; then
    echo "⚠️  REST APIを使用した更新は現在サポートされていません。"
    echo "   以下の手順でGoogle Cloud Consoleから手動設定してください："
    echo ""
    echo "📝 手順："
    echo ""
    echo "1. Google Cloud Consoleにアクセス:"
    echo "   https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
    echo ""
    echo "2. OAuth 2.0 クライアント IDを選択"
    echo "   Client ID: $CLIENT_ID"
    echo ""
    echo "3. 「承認済みのリダイレクト URI」セクションで、以下を追加:"
    echo "   ✅ $CLOUD_RUN_URL/api/auth/callback/google"
    echo "   ✅ $CUSTOM_DOMAIN/api/auth/callback/google"
    echo "   ✅ http://localhost:3000/api/auth/callback/google (ローカル開発用)"
    echo ""
    echo "4. 「承認済みの JavaScript 生成元」セクションで、以下を追加:"
    echo "   ✅ $CLOUD_RUN_URL"
    echo "   ✅ $CUSTOM_DOMAIN"
    echo "   ✅ http://localhost:3000 (ローカル開発用)"
    echo ""
    echo "5. 「保存」をクリック"
    echo ""
    echo "⚠️  重要: 両方のURLを追加しないと、どちらかのURLでログインできません。"
    echo ""
    exit 0
fi

echo "✅ 設定を更新しました"
