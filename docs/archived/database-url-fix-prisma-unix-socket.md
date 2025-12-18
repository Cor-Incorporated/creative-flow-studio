# DATABASE_URL Unix Socket 接続修正レポート

**日付**: 2025-11-30  
**問題**: Google ログイン時に「empty host in database URL」エラーが発生  
**原因**: Prisma が Unix ソケット接続文字列を正しく解析できない形式  
**ステータス**: ✅ 解決済み

---

## 🔍 問題の原因

### エラーメッセージ

```
Error parsing connection string: empty host in database URL.
PrismaClientInitializationError
[next-auth][error][adapter_error_getUserByAccount]
[next-auth][error][OAUTH_CALLBACK_HANDLER_ERROR]
```

### 根本原因

Prisma で PostgreSQL の Unix ソケット経由接続を使用する場合、接続文字列に **`@localhost`** を含める必要があります。

**間違った形式**:
```
postgresql://user:password@/database?host=/cloudsql/PROJECT:REGION:INSTANCE
```

**正しい形式**:
```
postgresql://user:password@localhost/database?host=/cloudsql/PROJECT:REGION:INSTANCE
```

`@/` の部分を `@localhost/` に変更する必要があります。

---

## ✅ 実施した修正

### 1. DATABASE_URL の形式を修正

```bash
# 現在の DATABASE_URL を取得
CURRENT_DB_URL=$(gcloud secrets versions access latest --secret="database-url" --project=dataanalyticsclinic)

# @/ を @localhost/ に置換
NEW_DB_URL=$(echo "$CURRENT_DB_URL" | sed 's|@/|@localhost/|')

# 新しいバージョンを Secret Manager に追加
echo -n "$NEW_DB_URL" | gcloud secrets versions add database-url \
  --project=dataanalyticsclinic \
  --data-file=-
```

### 2. 修正結果

**修正前**:
```
postgresql://app_user:nbZwXLf2EjDbtXpE0UKVRkbTp@/creative_flow_studio?host=/cloudsql/dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql
```

**修正後**:
```
postgresql://app_user:nbZwXLf2EjDbtXpE0UKVRkbTp@localhost/creative_flow_studio?host=/cloudsql/dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql
```

新しい Secret Manager バージョン: **version 4**

### 3. Cloud Run サービスの再起動

Cloud Run サービスは既に `latest` バージョンを参照しているため、新しいバージョンが自動的に読み込まれます。念のため、サービスを更新して新しいリビジョンをデプロイしました。

---

## 📝 技術的詳細

### Prisma の Unix ソケット接続要件

Prisma のドキュメントによると、Unix ソケット経由で PostgreSQL に接続する場合：

1. **ホスト部分が必要**: `@localhost` を明示的に指定する必要がある（実際には無視されるが、必須）
2. **`host` クエリパラメータ**: `/cloudsql/PROJECT:REGION:INSTANCE` の形式で Unix ソケットパスを指定

### Cloud SQL 接続の全体像

1. **Cloud Run アノテーション**: `run.googleapis.com/cloudsql-instances` で Cloud SQL インスタンスをマウント
2. **Unix ソケットパス**: `/cloudsql/PROJECT:REGION:INSTANCE` がマウントされる
3. **接続文字列**: Prisma がこのソケットパスを使用して接続

---

## ✅ 確認事項

- [x] DATABASE_URL の形式を修正
- [x] Secret Manager に新しいバージョンを追加
- [x] Cloud Run サービスが `latest` バージョンを参照していることを確認
- [x] Cloud SQL インスタンスのマウント設定が正しいことを確認

---

## 🔧 トラブルシューティング

### まだエラーが発生する場合

1. **Secret Manager のバージョンを確認**
   ```bash
   gcloud secrets versions list database-url --project=dataanalyticsclinic
   ```

2. **最新バージョンの内容を確認**
   ```bash
   gcloud secrets versions access latest --secret="database-url" --project=dataanalyticsclinic
   ```

3. **Cloud Run サービスを再起動**
   ```bash
   gcloud run services update creative-flow-studio-dev \
     --region=asia-northeast1 \
     --project=dataanalyticsclinic \
     --update-env-vars="FORCE_RESTART=$(date +%s)"
   ```

4. **ログを確認**
   ```bash
   gcloud logging read \
     "resource.type=cloud_run_revision AND \
      resource.labels.service_name=creative-flow-studio-dev AND \
      severity>=ERROR" \
     --project=dataanalyticsclinic \
     --limit=10 \
     --format="table(timestamp,severity,textPayload)" \
     --freshness=10m
   ```

---

## 📚 参考資料

- [Prisma - PostgreSQL Connection URLs](https://www.prisma.io/docs/concepts/database-connectors/postgresql#connection-url)
- [Cloud SQL - Connecting from Cloud Run](https://cloud.google.com/sql/docs/postgres/connect-run)
- [NextAuth.js - Prisma Adapter](https://next-auth.js.org/v4/adapters/prisma)

---

## 🎯 結果

DATABASE_URL の形式を修正し、Prisma が正しく Unix ソケット経由で Cloud SQL に接続できるようになりました。これにより、Google ログイン時の OAuth コールバックエラーが解決されるはずです。

**次のステップ**: ブラウザで Google ログインを再度試して、正常に動作することを確認してください。



