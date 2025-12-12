#!/bin/bash
# Cloud Buildトリガーを手動で実行するスクリプト

set -euo pipefail

PROJECT_ID="dataanalyticsclinic"
REGION="global"  # GitHub接続はglobalリージョンで作成されている
TRIGGER_NAME="creative-flow-dev-trigger"
BRANCH="develop"
REPO_FULL_NAME="Cor-Incorporated/creative-flow-studio"
SERVICE_ACCOUNT="projects/${PROJECT_ID}/serviceAccounts/cloud-build-runner@dataanalyticsclinic.iam.gserviceaccount.com"
CONNECTION_NAME="${CLOUD_BUILD_CONNECTION_NAME:-}"

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

    if [[ -z "$CONNECTION_NAME" ]]; then
      echo "🔍 Cloud BuildのGitHub接続名を自動検出しています..."
      CONNECTION_NAME=$(gcloud builds connections list \
        --project="$PROJECT_ID" \
        --region="$REGION" \
        --format="value(name)" \
        --limit=1 2>/dev/null || true)
    fi

    if [[ -z "$CONNECTION_NAME" ]]; then
      echo "❌ GitHub接続（Cloud Build Connections）が見つかりません。"
      echo "   先にGCP側でGitHub接続を作成し、再実行してください。"
      echo "   もしくは環境変数 CLOUD_BUILD_CONNECTION_NAME を指定してください。"
      exit 1
    fi

    gcloud builds triggers create github \
      --region="$REGION" \
      --project="$PROJECT_ID" \
      --name="$TRIGGER_NAME" \
      --connection="$CONNECTION_NAME" \
      --repo="$REPO_FULL_NAME" \
      --branch-pattern="^develop$" \
      --build-config="cloudbuild.yaml" \
      --substitutions=_NEXT_PUBLIC_APP_URL="https://creative-flow-studio-667780715339.asia-northeast1.run.app",_NEXT_PUBLIC_SUPABASE_URL="SET_IN_TRIGGER",SHORT_SHA="automatic" \
      --service-account="$SERVICE_ACCOUNT"
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






