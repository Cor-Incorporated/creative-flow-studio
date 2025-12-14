# Cloud Buildトリガー作成の正しい手順

## エラーの原因

`INVALID_ARGUMENT`エラーが発生する原因：

1. **リージョンの不一致**: GitHub接続は`global`リージョンで作成されているが、トリガー作成時に`asia-northeast1`を指定している
2. **パラメータの形式**: `--repo-name`と`--repo-owner`の代わりに`--repo`を使用する必要がある
3. **接続パラメータ**: `--connection`パラメータが必要

## 正しい手順

### ステップ1: GitHub接続を確認

```bash
gcloud builds connections list \
  --project=dataanalyticsclinic \
  --region=global
```

出力例：
```
NAME                    REGION  INSTALLATION_STATE
github-creative-flow    global  READY
```

### ステップ2: リポジトリ接続を確認

```bash
gcloud builds connections repositories list \
  --project=dataanalyticsclinic \
  --region=global \
  --connection=github-creative-flow
```

出力例：
```
NAME                                    REMOTE_URI
creative-flow-repo                     https://github.com/Cor-Incorporated/creative-flow-studio
```

### ステップ3: トリガーを作成

**正しいコマンド**:

```bash
gcloud builds triggers create github \
  --region=global \
  --project=dataanalyticsclinic \
  --name="creative-flow-dev-trigger" \
  --connection="github-creative-flow" \
  --repo="Cor-Incorporated/creative-flow-studio" \
  --branch-pattern="^develop$" \
  --build-config="cloudbuild.yaml" \
  --substitutions=_NEXT_PUBLIC_APP_URL="https://creative-flow-studio-667780715339.asia-northeast1.run.app",_NEXT_PUBLIC_SUPABASE_URL="SET_IN_TRIGGER",SHORT_SHA="automatic" \
  --service-account=projects/dataanalyticsclinic/serviceAccounts/cloud-build-runner@dataanalyticsclinic.iam.gserviceaccount.com
```

**重要なポイント**:
- `--region=global`を使用（`asia-northeast1`ではない）
- `--connection`で接続名を指定（例: `github-creative-flow`）
- `--repo`は`OWNER/REPO`形式（例: `Cor-Incorporated/creative-flow-studio`）
- `--repo-name`と`--repo-owner`は使用しない

### ステップ4: トリガーの確認

```bash
gcloud builds triggers list \
  --project=dataanalyticsclinic \
  --region=global
```

### ステップ5: 手動でトリガーを実行（テスト）

```bash
gcloud builds triggers run creative-flow-dev-trigger \
  --branch=develop \
  --project=dataanalyticsclinic \
  --region=global
```

## 接続が存在しない場合

GitHub接続が存在しない場合は、まず接続を作成する必要があります：

```bash
# GitHub AppのインストールIDとApp IDが必要
gcloud builds connections create github \
  --region=global \
  --project=dataanalyticsclinic \
  --installation-id=INSTALLATION_ID \
  --app-id=APP_ID \
  --service-account=projects/dataanalyticsclinic/serviceAccounts/cloud-build-runner@dataanalyticsclinic.iam.gserviceaccount.com
```

GitHub AppのインストールIDとApp IDは、GCPコンソールの「Cloud Build」→「Connections」から確認できます。




