#!/bin/bash
# Google OAuth リダイレクトURI設定スクリプト
# 両方のURL（Cloud Run URLとカスタムドメイン）をリダイレクトURIに追加

set -euo pipefail

PROJECT_ID="dataanalyticsclinic"
CLOUD_RUN_URL="https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app"
CUSTOM_DOMAIN="https://blunaai.com"
CLIENT_ID="667780715339-45a76cdu34shn8rnqqn7fvr9682v1bcg.apps.googleusercontent.com"

echo "🔍 Google OAuth クライアントIDを確認しています..."
echo "✅ Client ID: ${CLIENT_ID:0:30}..."
echo ""

# Google OAuth APIを使用してリダイレクトURIを更新
echo "📝 Google OAuth 2.0クライアントのリダイレクトURIを更新します..."
echo ""

# 現在のOAuth 2.0クライアント設定を取得
echo "📋 現在の設定を確認しています..."
CURRENT_CONFIG=$(gcloud alpha iap oauth-clients describe "$CLIENT_ID" --project=$PROJECT_ID 2>/dev/null || echo "")

if [ -z "$CURRENT_CONFIG" ]; then
    echo "⚠️  gcloudコマンドでOAuth 2.0クライアントを直接更新することはできません。"
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
