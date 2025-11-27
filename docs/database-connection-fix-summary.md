# データベース接続エラー解決サマリ

**作成日**: 2025-11-17  
**問題**: OAuth認証後に`error=Callback`エラーが発生  
**根本原因**: Cloud Run環境でデータベース接続が失敗（`localhost:5432`に接続しようとしていた）  
**ステータス**: ✅ 修正完了（再デプロイ済み）

---

## 🔍 問題の原因

### ログから判明したエラー

```
Can't reach database server at `localhost:5432`
[next-auth][error][adapter_error_getUserByAccount]
[next-auth][error][OAUTH_CALLBACK_HANDLER_ERROR]
```

### 根本原因

1. **`DATABASE_URL`が正しく設定されていなかった**
   - Cloud Runが参照していた`secret-alias-1`が存在しなかった
   - または、値がローカル開発用（`localhost:5432`）になっていた

2. **Cloud SQLインスタンスのマウント設定が不足していた**
   - Cloud RunサービスにCloud SQLインスタンスのマウント設定がなかった
   - Unixソケット経由での接続ができなかった

---

## ✅ 実施した修正

### 1. Cloud SQLパスワードのリセット

```bash
NEW_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
gcloud sql users set-password app_user \
  --instance=creative-flow-studio-sql \
  --password="$NEW_PASSWORD" \
  --project=dataanalyticsclinic
```

### 2. 正しいDATABASE_URLの作成

```
postgresql://app_user:PASSWORD@/creative_flow_studio?host=/cloudsql/dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql
```

### 3. Secret Managerへの登録

```bash
echo -n "$DB_URL" | \
  gcloud secrets create secret-alias-1 \
  --project=dataanalyticsclinic \
  --replication-policy="automatic" \
  --data-file=-
```

### 4. Cloud SQLインスタンスのマウント設定

`cloudbuild.yaml`のデプロイステップで自動的に設定されます：

```yaml
- '--add-cloudsql-instances=${_CLOUD_SQL_INSTANCE}'
```

### 5. Cloud Buildでの再デプロイ

```bash
SHORT_SHA=$(git rev-parse --short HEAD)
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_NEXT_PUBLIC_APP_URL=https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app,_NEXT_PUBLIC_SUPABASE_URL=,SHORT_SHA=$SHORT_SHA \
  --project=dataanalyticsclinic
```

---

## 📋 確認事項

### Cloud Run環境変数の確認

```bash
gcloud run services describe creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --format="yaml(spec.template.spec.containers[0].env)" | \
  grep -A 5 "DATABASE_URL"
```

**期待される設定**:
```yaml
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      key: latest
      name: secret-alias-1
```

### Cloud SQLマウント設定の確認

```bash
gcloud run revisions describe REVISION_NAME \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --format="yaml(spec.volumes)"
```

**期待される設定**:
```yaml
- cloudSqlInstance:
    instances:
    - dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql
  name: cloudsql
```

---

## 🚀 動作確認手順

### 1. ブラウザでの確認

1. ブラウザで以下にアクセス：
   ```
   https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app
   ```

2. **「Googleでログイン」ボタンをクリック**

3. **期待される動作**:
   - ✅ `error=Callback` エラーが発生しない
   - ✅ Google アカウント選択画面が表示される
   - ✅ ログイン成功後、チャットUIが表示される
   - ✅ セッションが正常に作成される

### 2. ログの確認

```bash
# 最新のログを確認
gcloud run services logs read creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --limit=50 | \
  grep -i "error\|callback\|database\|prisma"
```

**期待される結果**: データベース接続エラーが発生しない

---

## ⚠️ 重要な注意事項

### Prisma ClientとDATABASE_URL

**Prisma Clientの生成**は`DATABASE_URL`を必要としませんが、**実行時の接続**には`DATABASE_URL`が必要です。

- **ビルド時**: `prisma generate`は`DATABASE_URL`を必要としない
- **実行時**: Prisma Clientは`DATABASE_URL`環境変数から接続情報を読み込む

### Cloud Run環境変数の設定

Cloud Runでは、環境変数は**実行時に**設定されます。ビルド時に`DATABASE_URL`が設定されていなくても、実行時に正しく設定されていれば問題ありません。

### Cloud SQL接続文字列の形式

Cloud Run環境では、**Unixソケット経由**でCloud SQLに接続する必要があります：

```
postgresql://USER:PASSWORD@/DATABASE_NAME?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME
```

**重要なポイント**:
- `host=/cloudsql/...` の形式を使用
- Cloud SQLインスタンスのマウント設定が必要
- `/cloudsql/CONNECTION_NAME` がマウントされる

---

## 🔗 関連ドキュメント

- `docs/auth-callback-error-fix.md` - OAuth Callback エラー解決レポート
- `docs/auth-invalid-client-fix.md` - invalid_client エラー解決レポート
- [Cloud SQL - Connecting from Cloud Run](https://cloud.google.com/sql/docs/postgres/connect-run)
- [Prisma - Connection URLs](https://www.prisma.io/docs/concepts/database-connectors/postgresql#connection-url)

---

**解決日**: 2025-11-17  
**担当**: Cursor (JavaSE-21 LTS)


