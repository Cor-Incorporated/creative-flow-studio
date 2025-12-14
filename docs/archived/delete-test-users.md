# テストユーザーの削除手順

## 概要

`company@cor-jp.com` と `kotaro.uchiho@gmail.com` 以外のすべてのユーザーを削除します。

## 方法1: Cloud SQL Proxy + psql

```bash
# 1. Cloud SQL Proxyを起動（別ターミナル）
gcloud sql instances describe creative-flow-studio-sql --project=dataanalyticsclinic --format="value(connectionName)"
# 出力: dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql

cloud-sql-proxy dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql

# 2. データベースに接続（別ターミナル）
PGPASSWORD=$(gcloud secrets versions access latest --secret="database-password" --project=dataanalyticsclinic) psql -h localhost -U app_user -d creative_flow_studio

# 3. 削除前に対象ユーザーを確認
SELECT email, role, "createdAt" FROM "users" 
WHERE email NOT IN ('company@cor-jp.com', 'kotaro.uchiho@gmail.com');

# 4. ユーザーを削除（CASCADEで関連レコードも削除）
BEGIN;

DELETE FROM "users" 
WHERE email NOT IN ('company@cor-jp.com', 'kotaro.uchiho@gmail.com');

COMMIT;

# 5. 残りのユーザーを確認
SELECT email, role FROM "users";
```

## 方法2: gcloud sql connect（推奨）

```bash
cd /Users/teradakousuke/Developer/creative-flow-studio

# SQLファイルを実行
gcloud sql connect creative-flow-studio-sql \
  --user=app_user \
  --database=creative_flow_studio \
  --project=dataanalyticsclinic \
  < scripts/delete-test-users.sql
```

## 方法3: Google Cloud Console

1. https://console.cloud.google.com/sql/instances にアクセス
2. `creative-flow-studio-sql` インスタンスを選択
3. 「データベース」タブ → `creative_flow_studio` を選択
4. Cloud Shellで以下を実行：

```sql
DELETE FROM "users" 
WHERE email NOT IN ('company@cor-jp.com', 'kotaro.uchiho@gmail.com');
```

## 注意事項

- CASCADE設定により、削除されたユーザーの以下のレコードも自動削除されます：
  - `sessions`
  - `conversations` と `messages`
  - `subscriptions`
  - `usage_logs`
  - `audit_logs`
  - `accounts`（OAuth連携）

- 削除は元に戻せません。必ず対象を確認してから実行してください。

## 削除後の確認

```sql
-- 残っているユーザー数を確認
SELECT COUNT(*) as user_count FROM "users";

-- 残っているユーザーを確認
SELECT email, role, "createdAt" FROM "users";
```

期待される結果：2ユーザー（`company@cor-jp.com`, `kotaro.uchiho@gmail.com`）
