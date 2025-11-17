#!/bin/bash
# Google OAuth 2.0 クライアント設定スクリプト
# Usage: ./scripts/setup-google-oauth.sh

set -e

PROJECT_ID="dataanalyticsclinic"
CLIENT_NAME="creative-flow-studio-dev"
REDIRECT_URI="https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/api/auth/callback/google"
ORIGIN_URI="https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app"

echo "🔍 Google OAuth 2.0 クライアント設定を開始します..."
echo ""

# OAuth2 API が有効か確認
echo "📋 OAuth2 API の有効化を確認..."
gcloud services enable oauth2.googleapis.com --project=$PROJECT_ID 2>&1 | grep -v "already enabled" || true

echo ""
echo "⚠️  注意: gcloudコマンドではOAuth 2.0クライアントIDを直接作成できません。"
echo "   以下の手順でGoogle Cloud Consoleから設定してください:"
echo ""
echo "📝 手順:"
echo ""
echo "1. Google Cloud Console にアクセス:"
echo "   https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
echo ""
echo "2. 「認証情報を作成」→「OAuth 2.0 クライアント ID」を選択"
echo ""
echo "3. 以下の設定を入力:"
echo "   - アプリケーションの種類: ウェブアプリケーション"
echo "   - 名前: $CLIENT_NAME"
echo "   - 承認済みのリダイレクト URI:"
echo "     $REDIRECT_URI"
echo "   - 承認済みの JavaScript 生成元:"
echo "     $ORIGIN_URI"
echo ""
echo "4. 「作成」をクリック"
echo ""
echo "5. 表示された「クライアント ID」と「クライアント シークレット」をコピー"
echo ""
echo "6. Secret Manager に登録:"
echo ""
echo "   # Client ID を登録"
echo "   echo -n 'YOUR_CLIENT_ID' | \\"
echo "     gcloud secrets versions add google-client-id \\"
echo "     --project=$PROJECT_ID \\"
echo "     --data-file=-"
echo ""
echo "   # Client Secret を登録"
echo "   echo -n 'YOUR_CLIENT_SECRET' | \\"
echo "     gcloud secrets versions add google-client-secret \\"
echo "     --project=$PROJECT_ID \\"
echo "     --data-file=-"
echo ""
echo "✅ 設定完了後、Cloud Run サービスを再デプロイしてください。"
echo ""

