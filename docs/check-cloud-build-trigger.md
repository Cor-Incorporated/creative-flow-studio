# Cloud Buildトリガー確認手順

## 問題
`develop`ブランチにpushしてもCloud Buildが自動的にトリガーされない

## 確認手順

### 1. Cloud Buildトリガーの一覧を確認

```bash
gcloud builds triggers list \
  --project=dataanalyticsclinic \
  --region=asia-northeast1
```

### 2. 特定のトリガーの詳細を確認

```bash
gcloud builds triggers describe creative-flow-dev-trigger \
  --project=dataanalyticsclinic \
  --region=asia-northeast1
```

### 3. トリガーが存在しない場合、作成する

```bash
gcloud builds triggers create github \
  --name="creative-flow-dev-trigger" \
  --repo-name="creative-flow-studio" \
  --repo-owner="Cor-Incorporated" \
  --branch-pattern="^develop$" \
  --build-config="cloudbuild.yaml" \
  --project=dataanalyticsclinic \
  --region=asia-northeast1 \
  --substitutions=_NEXT_PUBLIC_APP_URL="https://creative-flow-studio-667780715339.asia-northeast1.run.app",_NEXT_PUBLIC_SUPABASE_URL="SET_IN_TRIGGER",SHORT_SHA="automatic"
```

### 4. 手動でトリガーを実行（テスト用）

```bash
gcloud builds triggers run creative-flow-dev-trigger \
  --branch=develop \
  --project=dataanalyticsclinic \
  --region=asia-northeast1
```

## 注意事項

- Cloud BuildのトリガーはGitHubリポジトリがCloud Buildに接続されている必要があります
- 接続されていない場合は、GitHubリポジトリのSettings → Integrations → Google Cloud Buildで接続してください
