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

```bash
gcloud builds triggers list \
  --project=dataanalyticsclinic \
  --region=asia-northeast1
```

#### 2. トリガーが存在しない場合、作成する

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

#### 3. 手動でトリガーを実行（テスト用）

```bash
gcloud builds triggers run creative-flow-dev-trigger \
  --branch=develop \
  --project=dataanalyticsclinic \
  --region=asia-northeast1
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
