# DATABASE_URL設定ガイド（決定版）

**最終更新**: 2025-12-01  
**ステータス**: ✅ 検証済み・動作確認完了

---

## 🎯 概要

このドキュメントは、Cloud RunからCloud SQLへの接続で正しく動作する**唯一の正しいDATABASE_URLフォーマット**を定義します。

過去に多数の試行錯誤を経て、最終的に動作が確認された設定を記録しています。

---

## ✅ 正しいDATABASE_URLフォーマット

### 本番環境（Cloud Run + Cloud SQL Unix Socket）

```bash
postgresql://app_user:PASSWORD@localhost/creative_flow_studio?host=/cloudsql/dataanalyticsclinic%3Aasia-northeast1%3Acreative-flow-studio-sql
```

### 重要なポイント

1. **`@localhost`を使用** ← `@/`では**動作しません**
2. **コロン（`:`）を`%3A`にURLエンコード** ← これが決定的に重要
3. **`host=`パラメータでUnix socketパスを指定**
4. **パスワード**: `hji6J8PGfVlkeymrhZ0dTbaZ`（Secret Manager バージョン13で確認済み）

---

## ❌ 動作しないフォーマット（絶対に使わないこと）

### パターン1: `@/`形式
```bash
# ❌ empty host in database URL エラーが発生
postgresql://app_user:PASSWORD@/creative_flow_studio?host=/cloudsql/dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql
```

**エラー内容:**
```
PrismaClientInitializationError: 
The provided database string is invalid. 
Error parsing connection string: empty host in database URL.
```

### パターン2: URLエンコードなし
```bash
# ❌ Can't reach database server エラーが発生
postgresql://app_user:PASSWORD@localhost/creative_flow_studio?host=/cloudsql/dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql
```

**エラー内容:**
```
Can't reach database server at `/cloudsql/dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql:5432`
```

### パターン3: 間違ったパスワード
```bash
# ❌ password authentication failed エラーが発生
postgresql://app_user:nbZwXLf2EjDbtXpE0UKVRkbTp@localhost/...
```

**エラー内容:**
```
FATAL: password authentication failed for user "app_user"
```

---

## 🔧 設定手順

### 1. Secret Managerに正しいDATABASE_URLを設定

```bash
cd /Users/teradakousuke/Developer/creative-flow-studio

# 正しいフォーマットでDATABASE_URLを作成
echo "postgresql://app_user:hji6J8PGfVlkeymrhZ0dTbaZ@localhost/creative_flow_studio?host=/cloudsql/dataanalyticsclinic%3Aasia-northeast1%3Acreative-flow-studio-sql" | \
  gcloud secrets versions add database-url \
    --project=dataanalyticsclinic \
    --data-file=-
```

### 2. Cloud Runの設定確認

```bash
# DATABASE_URLが正しいシークレットを参照していることを確認
gcloud run services describe creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --format="value(spec.template.spec.containers[0].env)" | \
  grep DATABASE_URL

# 期待される出力:
# {'name': 'DATABASE_URL', 'valueFrom': {'secretKeyRef': {'key': 'latest', 'name': 'database-url'}}}
```

### 3. VPC Egress設定の確認

```bash
# VPC egressがprivate-ranges-onlyであることを確認
gcloud run services describe creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --format="value(spec.template.metadata.annotations.\"run.googleapis.com/vpc-access-egress\")"

# 期待される出力: private-ranges-only
```

**重要:** `all-traffic`では動作しません。`private-ranges-only`を使用してください。

### 4. Cloud Runの再デプロイ

```bash
gcloud run services update creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --update-env-vars=TRIGGER_REDEPLOY="$(date +%s)"
```

---

## 🏗️ ビルド時の設定

### cloudbuild.yaml

ビルド時には**ダミーのDATABASE_URL**を設定する必要があります：

```yaml
- id: 'Build Next.js app'
  name: 'docker.io/library/node@sha256:...'
  entrypoint: npm
  args: ['run', 'build']
  env:
    - 'NEXT_PUBLIC_APP_URL=${_NEXT_PUBLIC_APP_URL}'
    - 'NEXT_PUBLIC_SUPABASE_URL=${_NEXT_PUBLIC_SUPABASE_URL}'
    # ビルド時のダミーDATABASE_URL（実行時には上書きされる）
    - 'DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy'
```

### Dockerfile

```dockerfile
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL:-}
```

**理由:** Next.jsのビルド時にPrisma Clientが初期化されるため、DATABASE_URLが設定されていないとビルドエラーが発生します。実行時には、Cloud RunがSecret Managerから正しいDATABASE_URLを読み込みます。

---

## 🧪 動作確認方法

### 1. ログの確認

```bash
# 過去5分間のエラーログを確認（何も表示されなければ成功）
gcloud logging read \
  "resource.type=cloud_run_revision AND \
   resource.labels.service_name=creative-flow-studio-dev AND \
   timestamp>=\"$(date -u -v-5M '+%Y-%m-%dT%H:%M:%S')Z\" AND \
   (textPayload=~'.*error.*' OR textPayload=~'.*ERROR.*' OR textPayload=~'.*empty host.*' OR textPayload=~'.*Can'\''t reach.*' OR textPayload=~'.*password authentication failed.*')" \
  --project=dataanalyticsclinic \
  --limit=50 \
  --format=json | jq 'length'

# 期待される出力: 0
```

### 2. データベース接続の確認

```bash
# Prisma初期化ログを確認
gcloud logging read \
  "resource.type=cloud_run_revision AND \
   resource.labels.service_name=creative-flow-studio-dev AND \
   textPayload=~'.*\\[Prisma\\] DATABASE_URL is set.*'" \
  --project=dataanalyticsclinic \
  --limit=1 \
  --format=json | jq -r '.[0].textPayload'

# 期待される出力:
# [Prisma] DATABASE_URL is set: postgresql://app_user:****@localhost/creative_flow_studio?host=/cloudsql/dataanalyticsclinic%3Aasia-...
```

### 3. 実際のログインテスト

**テストアカウント:**
- メール: `kotaro.uchiho@gmail.com`
- パスワード: `test12345`
- ロール: ADMIN

```bash
# curlでログインテスト
curl -X POST https://blunaai.com/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=kotaro.uchiho@gmail.com&password=test12345&csrfToken=test&action=login" \
  -v 2>&1 | grep "HTTP"

# 期待される出力: HTTP/2 302（リダイレクト成功）
```

---

## 📚 技術的背景

### Prismaの接続文字列パーサーの動作

Prismaは接続文字列を以下のように解析します：

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?PARAMS
           ↓        ↓       ↓     ↓      ↓        ↓
         必須     必須      必須  任意   必須   任意
```

**Cloud SQL Unix Socket接続の特殊性:**

1. `@localhost`は**プレースホルダー**（実際には使用されない）
2. 実際の接続先は`host=`パラメータで指定されたUnix socketパス
3. Prismaのパーサーは`@`の直後に何かしらのホスト名を期待する
4. `@/`では「empty host」と判定される
5. コロン（`:`）がURLパーサーでポート番号として解釈されるため、URLエンコードが必要

### Cloud SQL Proxyのマウント

Cloud Runでは、以下のアノテーションによりCloud SQL Proxyが自動的にマウントされます：

```yaml
run.googleapis.com/cloudsql-instances: dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql
```

これにより、以下のUnix socketが利用可能になります：

```
/cloudsql/dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql/
```

---

## 🚨 トラブルシューティング

### エラー1: empty host in database URL

**症状:**
```
Error parsing connection string: empty host in database URL
```

**原因:** `@/`形式を使用している  
**解決策:** `@localhost`に変更

### エラー2: Can't reach database server

**症状:**
```
Can't reach database server at `/cloudsql/PROJECT:REGION:INSTANCE:5432`
```

**原因:** コロン（`:`）がURLエンコードされていない  
**解決策:** `:`を`%3A`にエンコード

### エラー3: password authentication failed

**症状:**
```
FATAL: password authentication failed for user "app_user"
```

**原因:** パスワードが間違っている  
**解決策:** 正しいパスワード`hji6J8PGfVlkeymrhZ0dTbaZ`を使用

### エラー4: connection to Cloud SQL instance at 34.146.91.205:3307 failed

**症状:**
```
connection to Cloud SQL instance at 34.146.91.205:3307 failed: timed out after 10s
```

**原因:** VPC egressが`all-traffic`になっている、またはVPC Connectorの設定が間違っている  
**解決策:** `vpc-egress=private-ranges-only`に設定

---

## 📝 チェックリスト

デプロイ前に以下を確認してください：

- [ ] DATABASE_URLが`@localhost`形式を使用
- [ ] コロン（`:`）が`%3A`にURLエンコード済み
- [ ] パスワードが`hji6J8PGfVlkeymrhZ0dTbaZ`
- [ ] VPC egressが`private-ranges-only`
- [ ] Cloud SQL接続アノテーションが設定済み
- [ ] ビルド時にダミーDATABASE_URLが設定されている
- [ ] Dockerfileに`ARG DATABASE_URL`と`ENV DATABASE_URL=${DATABASE_URL:-}`がある

---

## 🔗 関連ドキュメント

- [Prisma - PostgreSQL Connection URLs](https://www.prisma.io/docs/concepts/database-connectors/postgresql#connection-url)
- [Cloud SQL - Connecting from Cloud Run](https://cloud.google.com/sql/docs/postgres/connect-run)
- [Cloud Run - VPC Access](https://cloud.google.com/run/docs/configuring/vpc-direct-vpc)

---

## 📊 検証済みの設定（2025-12-01）

**成功したリビジョン:** `creative-flow-studio-dev-00053-8ss`  
**ビルド:** `f036a825-d14f-48bf-b6a1-761dfa4cc6fc`  
**DATABASE_URL Secret Manager バージョン:** 13

**テスト結果:**
- ✅ メール/パスワード認証成功
- ✅ データベース読み書き正常
- ✅ エラーログ0件（過去5分間）
- ✅ ダッシュボード表示成功

**テストアカウント:**
- メール: kotaro.uchiho@gmail.com
- パスワード: test12345
- ロール: ADMIN

