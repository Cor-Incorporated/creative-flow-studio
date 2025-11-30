# Cloud Buildトリガーが起動しない問題の解決方法

## 問題の原因

1. **GitHub Actionsの「Terraform Deploy」ワークフロー**は、`infra/**`パスが変更された場合のみトリガーされます
   - 今回のpushには`infra/**`の変更が含まれていないため、正常にトリガーされていません
   - これは**正常な動作**です（インフラ変更用のワークフロー）

2. **Cloud Buildのトリガー**が正しく設定されていない可能性があります
   - Cloud Buildはアプリケーションコード（Next.js）のデプロイ用です
   - `develop`ブランチへのpushで自動的にトリガーされるはずです

## 解決方法

### 方法1: Cloud Buildトリガーを確認・作成

#### 1. トリガーの存在確認

**重要**: GitHub接続は`global`リージョンで作成されているため、トリガーも`global`リージョンで確認する必要があります。

```bash
gcloud builds triggers list \
  --project=dataanalyticsclinic \
  --region=global
```

#### 2. GitHub接続を確認

まず、GitHub接続が存在するか確認：

```bash
gcloud builds connections list \
  --project=dataanalyticsclinic \
  --region=global
```

接続が存在しない場合、作成する必要があります（GitHub AppのインストールIDとApp IDが必要）：

```bash
gcloud builds connections create github \
  --region=global \
  --project=dataanalyticsclinic \
  --installation-id=INSTALLATION_ID \
  --app-id=APP_ID \
  --service-account=projects/dataanalyticsclinic/serviceAccounts/cloud-build-runner@dataanalyticsclinic.iam.gserviceaccount.com
```

#### 3. リポジトリ接続を確認

```bash
gcloud builds connections list \
  --project=dataanalyticsclinic \
  --region=global \
  --connection=CONNECTION_NAME
```

#### 4. トリガーが存在しない場合、作成する

**重要**: GitHub接続は`global`リージョンで作成されているため、トリガーも`global`リージョンで作成する必要があります。

```bash
# まず、接続名とリポジトリ名を確認
gcloud builds connections list \
  --project=dataanalyticsclinic \
  --region=global

# 接続名が分かったら、以下の形式でトリガーを作成
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

**注意**: 
- `--region=global`を使用（`asia-northeast1`ではない）
- `--repo`は`OWNER/REPO`形式（`--repo-name`と`--repo-owner`ではない）
- `--connection`で接続名を指定する必要がある

#### 5. 手動でトリガーを実行（テスト用）

```bash
gcloud builds triggers run creative-flow-dev-trigger \
  --branch=develop \
  --project=dataanalyticsclinic \
  --region=global
```

### 方法2: スクリプトを使用

```bash
./scripts/trigger-cloud-build.sh
```

### 方法3: GitHub Actionsを手動で実行

GitHubリポジトリのActionsタブから「Terraform Deploy」ワークフローを選択し、「Run workflow」ボタンをクリックして手動で実行できます。

## 確認事項

### Cloud Buildのトリガーが正しく設定されているか確認

1. GCPコンソールでCloud Build → Triggersを開く
2. `creative-flow-dev-trigger`が存在するか確認
3. ブランチパターンが`^develop$`になっているか確認
4. ビルド設定ファイルが`cloudbuild.yaml`になっているか確認

### GitHubリポジトリがCloud Buildに接続されているか確認

1. GCPコンソールでCloud Build → Triggersを開く
2. 「Connect Repository」をクリック
3. GitHubリポジトリが接続されているか確認

## 今後の対応

### アプリケーションコードの変更時

- Cloud Buildが自動的にトリガーされる（`develop`ブランチへのpush）
- マイグレーション、ビルド、デプロイが自動実行される

### インフラの変更時

- GitHub Actionsの「Terraform Deploy」ワークフローが自動的にトリガーされる（`infra/**`の変更時）
- Terraformが自動実行される

## トラブルシューティング

### Cloud Buildが起動しない場合

1. トリガーが存在するか確認
2. ブランチパターンが正しいか確認
3. GitHubリポジトリが接続されているか確認
4. 手動でトリガーを実行してテスト

### ビルドが失敗する場合

1. Cloud Buildのログを確認
2. Secret Managerの設定を確認
3. サービスアカウントの権限を確認
