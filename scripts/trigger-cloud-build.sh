#!/bin/bash
# Cloud Buildトリガーを手動で実行するスクリプト

set -euo pipefail

PROJECT_ID="dataanalyticsclinic"
REGION="asia-northeast1"
TRIGGER_NAME="creative-flow-dev-trigger"
BRANCH="develop"

echo "🔍 Cloud Buildトリガーを確認しています..."

# トリガーの存在確認
if ! gcloud builds triggers describe "$TRIGGER_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" &>/dev/null; then
  echo "❌ トリガー '$TRIGGER_NAME' が見つかりません"
  echo ""
  echo "📝 トリガーを作成しますか？ (y/n)"
  read -r response
  if [[ "$response" =~ ^[Yy]$ ]]; then
    echo "🔧 トリガーを作成しています..."
    gcloud builds triggers create github \
      --name="$TRIGGER_NAME" \
      --repo-name="creative-flow-studio" \
      --repo-owner="Cor-Incorporated" \
      --branch-pattern="^develop$" \
      --build-config="cloudbuild.yaml" \
      --project="$PROJECT_ID" \
      --region="$REGION" \
      --substitutions=_NEXT_PUBLIC_APP_URL="https://creative-flow-studio-667780715339.asia-northeast1.run.app",_NEXT_PUBLIC_SUPABASE_URL="SET_IN_TRIGGER",SHORT_SHA="automatic"
    echo "✅ トリガーを作成しました"
  else
    echo "❌ トリガーの作成をキャンセルしました"
    exit 1
  fi
fi

echo "🚀 Cloud Buildトリガーを実行しています..."
gcloud builds triggers run "$TRIGGER_NAME" \
  --branch="$BRANCH" \
  --project="$PROJECT_ID" \
  --region="$REGION"

echo "✅ Cloud Buildが開始されました"
echo "📊 ビルドの進捗を確認:"
echo "   gcloud builds list --project=$PROJECT_ID --region=$REGION --limit=1"
