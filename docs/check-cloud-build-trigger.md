# Cloud Buildトリガー確認手順

## 問題
`develop`ブランチにpushしてもCloud Buildが自動的にトリガーされない

## 確認手順

### 1. Cloud Buildトリガーの一覧を確認

```bash
# 重要: GitHub接続はglobalリージョンで作成されているため、globalを指定
gcloud builds triggers list \
  --project=dataanalyticsclinic \
  --region=global
```

### 2. 特定のトリガーの詳細を確認

```bash
gcloud builds triggers describe creative-flow-dev-trigger \
  --project=dataanalyticsclinic \
  --region=global
```

### 3. トリガーが存在しない場合、作成する

```bash
# まず、GitHub接続名を確認
gcloud builds connections list \
  --project=dataanalyticsclinic \
  --region=global

# 接続名が分かったら、以下の形式でトリガーを作成
# 重要: --region=global を使用（GitHub接続はglobalリージョン）
gcloud builds triggers create github \
  --region=global \
  --project=dataanalyticsclinic \
  --name="creative-flow-dev-trigger" \
  --connection=CONNECTION_NAME \
  --repo="Cor-Incorporated/creative-flow-studio" \
  --branch-pattern="^develop$" \
  --build-config="cloudbuild.yaml" \
  --substitutions=_NEXT_PUBLIC_APP_URL="https://creative-flow-studio-667780715339.asia-northeast1.run.app",_NEXT_PUBLIC_SUPABASE_URL="SET_IN_TRIGGER",SHORT_SHA="automatic" \
  --service-account=projects/dataanalyticsclinic/serviceAccounts/cloud-build-runner@dataanalyticsclinic.iam.gserviceaccount.com
```

### 4. 手動でトリガーを実行（テスト用）

```bash
gcloud builds triggers run creative-flow-dev-trigger \
  --branch=develop \
  --project=dataanalyticsclinic \
  --region=global
```

## 注意事項

- Cloud BuildのトリガーはGitHubリポジトリがCloud Buildに接続されている必要があります
- 接続されていない場合は、GitHubリポジトリのSettings → Integrations → Google Cloud Buildで接続してください
