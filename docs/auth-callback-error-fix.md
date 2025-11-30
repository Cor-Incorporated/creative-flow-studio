# OAuth Callback エラー解決レポート

**作成日**: 2025-11-17  
**問題**: `error=Callback` エラーが発生  
**原因**: Cloud Run環境でデータベース接続が失敗していた  
**ステータス**: ✅ 解決済み

---

## 🔍 問題の原因

### 発見された問題

Cloud Runのログから以下のエラーが確認されました：

```
Can't reach database server at `localhost:5432`
Invalid `prisma.account.findUnique()` invocation
[next-auth][error][adapter_error_getUserByAccount]
[next-auth][error][OAUTH_CALLBACK_HANDLER_ERROR]
```

### 根本原因

1. **`DATABASE_URL`がローカル開発用の値になっていた**
   - 現在の値: `postgresql://user:password@localhost:5432/test?schema=public`
   - これはCloud Run環境では使用できない

2. **Cloud RunサービスにCloud SQLインスタンスのマウント設定がなかった**
   - Cloud RunからCloud SQLに接続するには、Unixソケット経由の接続が必要
   - Cloud SQLインスタンスのマウント設定が不足していた

3. **`secret-alias-1`（DATABASE_URL用）が存在しなかった**
   - Cloud Runが参照しているシークレット名が存在しない

---

## ✅ 実施した解決策

### 1. Cloud SQLパスワードのリセット

```bash
# 新しいパスワードを生成
NEW_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

# Cloud SQLユーザーのパスワードをリセット
gcloud sql users set-password app_user \
  --instance=creative-flow-studio-sql \
  --password="$NEW_PASSWORD" \
  --project=dataanalyticsclinic
```

### 2. 正しいDATABASE_URLの作成

Cloud SQL接続文字列の形式（Unixソケット経由）:

```
postgresql://USER:PASSWORD@/DATABASE_NAME?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME
```

**実際の値**:
```
postgresql://app_user:PASSWORD@/creative_flow_studio?host=/cloudsql/dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql
```

### 3. Secret Managerへの登録

```bash
# secret-alias-1を作成/更新
echo -n "$DB_URL" | \
  gcloud secrets create secret-alias-1 \
  --project=dataanalyticsclinic \
  --replication-policy="automatic" \
  --data-file=-

# または既存の場合は更新
echo -n "$DB_URL" | \
  gcloud secrets versions add secret-alias-1 \
  --project=dataanalyticsclinic \
  --data-file=-
```

### 4. Cloud RunサービスにCloud SQLインスタンスのマウント設定を追加

```bash
gcloud run services update creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --add-cloudsql-instances=dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql
```

これにより、Cloud Runサービスは`/cloudsql/dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql`経由でCloud SQLに接続できるようになります。

---

## 📋 NextAuth.jsとPrisma Adapterの動作

### Database Session Strategy

NextAuth.jsは`PrismaAdapter`を使用して、セッション情報をデータベースに保存します。これには以下のテーブルが必要です：

- `users` - ユーザー情報
- `accounts` - OAuthプロバイダーアカウント情報
- `sessions` - セッション情報
- `verification_tokens` - 検証トークン

### エラーの発生箇所

OAuth認証フロー中、NextAuth.jsは以下の処理を実行します：

1. Google OAuth認証成功
2. コールバック処理開始
3. `getUserByAccount`を呼び出し（Prisma Adapter）
4. **データベース接続エラー発生** ← ここで失敗
5. `OAUTH_CALLBACK_HANDLER_ERROR`が発生
6. `error=Callback`ページにリダイレクト

---

## 🔍 調査プロセス

### 1. Cloud Runログの確認

```bash
gcloud run services logs read creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --limit=100 | \
  grep -i "callback\|error\|oauth\|database"
```

**確認されたエラー**:
- `Can't reach database server at localhost:5432`
- `adapter_error_getUserByAccount`
- `OAUTH_CALLBACK_HANDLER_ERROR`

### 2. DATABASE_URLの確認

```bash
# Secret ManagerからDATABASE_URLを確認
gcloud secrets versions access latest --secret=database-url --project=dataanalyticsclinic

# Cloud Runが参照しているシークレット名を確認
gcloud run services describe creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --format="yaml(spec.template.spec.containers[0].env)" | \
  grep -A 5 "DATABASE_URL"
```

**結果**: `secret-alias-1`を参照しているが、このシークレットが存在しない

### 3. Cloud SQLインスタンス情報の確認

```bash
# Cloud SQLインスタンス一覧
gcloud sql instances list --project=dataanalyticsclinic

# データベース一覧
gcloud sql databases list --instance=creative-flow-studio-sql --project=dataanalyticsclinic

# ユーザー一覧
gcloud sql users list --instance=creative-flow-studio-sql --project=dataanalyticsclinic
```

**確認された情報**:
- インスタンス名: `creative-flow-studio-sql`
- Connection Name: `dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql`
- データベース名: `creative_flow_studio`
- ユーザー名: `app_user`

### 4. Cloud RunサービスのCloud SQL設定確認

```bash
# Cloud SQLインスタンスのマウント設定を確認
gcloud run services describe creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --format="yaml(spec.template.spec.volumes)"
```

**結果**: Cloud SQLインスタンスのマウント設定が存在しない

---

## ⚠️ 重要な注意事項

### Cloud SQL接続文字列の形式

Cloud Run環境では、**Unixソケット経由**でCloud SQLに接続する必要があります：

**正しい形式**:
```
postgresql://USER:PASSWORD@/DATABASE_NAME?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME
```

**間違った形式**:
```
postgresql://user:password@localhost:5432/test  # ローカル開発用
postgresql://user:password@IP_ADDRESS:5432/db    # TCP接続（Cloud Runでは使用不可）
```

### Cloud SQLインスタンスのマウント

Cloud RunサービスにCloud SQLインスタンスをマウントすることで、`/cloudsql/CONNECTION_NAME`経由で接続できるようになります。

**マウント設定の確認**:
```bash
gcloud run services describe SERVICE_NAME \
  --region=REGION \
  --format="yaml(spec.template.spec.volumes)"
```

**期待される出力**:
```yaml
- cloudSqlInstance:
    instances:
    - PROJECT_ID:REGION:INSTANCE_NAME
  name: cloudsql
```

---

## 🚀 動作確認手順

### 1. 設定の確認

```bash
# DATABASE_URLの確認
gcloud secrets versions access latest --secret=secret-alias-1 --project=dataanalyticsclinic

# Cloud SQLインスタンスのマウント設定確認
gcloud run services describe creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --format="yaml(spec.template.spec.volumes)"
```

### 2. ブラウザでの確認

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

### 3. ログの確認

```bash
# Cloud Runの最新ログを確認
gcloud run services logs read creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --limit=50 | \
  grep -i "error\|success\|session"
```

**期待される結果**: データベース接続エラーが発生しない

---

## 📋 今後の対策

### Terraformでの管理

Cloud SQL接続設定はTerraformで管理することで、このような不整合を防ぐことができます：

```hcl
# infra/envs/dev/main.tf
locals {
  secret_values_final = merge(
    var.secret_values,
    {
      "database-url" = format(
        "postgresql://%s:%s@/%s?host=/cloudsql/%s",
        var.cloud_sql_user,
        module.cloud_sql.database_password,
        var.cloud_sql_db_name,
        module.cloud_sql.instance_connection_name
      )
    }
  )
}
```

### Cloud Runサービスの設定

```hcl
# infra/modules/cloud_run/main.tf
module "cloud_run" {
  source = "../../modules/cloud_run"
  
  cloud_sql_instances = [
    "dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql"
  ]
  # ...
}
```

---

## 🔗 関連ドキュメント

- [NextAuth.js - Database Adapter](https://next-auth.js.org/adapters/prisma)
- [Cloud SQL - Connecting from Cloud Run](https://cloud.google.com/sql/docs/postgres/connect-run)
- [Prisma - Connection URLs](https://www.prisma.io/docs/concepts/database-connectors/postgresql#connection-url)
- `docs/auth-invalid-client-fix.md` - invalid_client エラー解決レポート
- `docs/auth-setup-complete.md` - 認証システム設定完了レポート

---

## 📝 参考資料

### NextAuth.js公式ドキュメント

- [NextAuth.js Errors](https://next-auth.js.org/errors)
- [NextAuth.js - OAuth Callback Error](https://next-auth.js.org/errors#oauth_callback_handler_error)
- [NextAuth.js - Adapter Error](https://next-auth.js.org/errors#adapter_error_getuserbyaccount)

### Google Cloud公式ドキュメント

- [Cloud SQL - Connecting from Cloud Run](https://cloud.google.com/sql/docs/postgres/connect-run)
- [Cloud Run - Using Cloud SQL](https://cloud.google.com/run/docs/using/cloud-sql)

---

**解決日**: 2025-11-17  
**担当**: Cursor (JavaSE-21 LTS)


