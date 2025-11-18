# DATABASE_URL 問題解決レポート（最終版）

**作成日**: 2025-11-18  
**問題**: Cloud Run環境で`DATABASE_URL`が`localhost:5432`に設定されている  
**根本原因**: Next.jsのビルド時に`DATABASE_URL`がハードコードされていた  
**ステータス**: 🔄 修正中

---

## 🔍 問題の原因

### 発見された問題

デバッグエンドポイント（`/api/debug/env`）の結果：
```json
{
  "DATABASE_URL_MASKED": "postgresql://user:****@localhost:5432/test?schema=public",
  "IS_LOCALHOST": true
}
```

しかし、Secret Managerの`secret-alias-1`には正しい値が設定されています：
```
postgresql://app_user:****@/creative_flow_studio?host=/cloudsql/dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql
```

### 根本原因

1. **Next.jsのビルド時に`DATABASE_URL`がハードコードされていた**
   - `cloudbuild.yaml`の`Build Next.js app`ステップで`DATABASE_URL`が`secretEnv`に設定されていた
   - Next.jsがビルド時に`DATABASE_URL`を読み込んで、それを保持していた
   - 実行時にCloud Runの環境変数が設定されても、ビルド時に読み込まれた値が優先されていた

2. **`availableSecrets`で`DATABASE_URL`が定義されていた**
   - Cloud Buildの`availableSecrets`セクションで`DATABASE_URL`が定義されていた
   - これにより、ビルドプロセス全体で`DATABASE_URL`が利用可能になっていた

---

## ✅ 実施した修正

### 1. `cloudbuild.yaml`の修正

**修正前**:
```yaml
availableSecrets:
    secretManager:
        - versionName: projects/${_PROJECT_ID}/secrets/database-url/versions/latest
          env: DATABASE_URL
        # ...

steps:
    - id: 'Build Next.js app'
      secretEnv:
          - DATABASE_URL
          # ...
```

**修正後**:
```yaml
availableSecrets:
    secretManager:
        # NOTE: DATABASE_URL is NOT included here - it's only set at runtime in Cloud Run
        # This prevents Next.js from hardcoding DATABASE_URL during build
        - versionName: projects/${_PROJECT_ID}/secrets/nextauth-secret/versions/latest
          env: NEXTAUTH_SECRET
        # ...

steps:
    - id: 'Build Next.js app'
      env:
          - 'NEXT_PUBLIC_APP_URL=${_NEXT_PUBLIC_APP_URL}'
          - 'NEXT_PUBLIC_SUPABASE_URL=${_NEXT_PUBLIC_SUPABASE_URL}'
          # NOTE: DATABASE_URL is NOT set during build - it's only set at runtime in Cloud Run
          # This prevents Next.js from hardcoding the DATABASE_URL during build
      secretEnv:
          - NEXTAUTH_SECRET
          # DATABASE_URL removed from here
          # ...
```

### 2. Secret Managerの再作成

```bash
# Secret Managerのsecret-alias-1を削除して再作成
gcloud secrets delete secret-alias-1 --project=dataanalyticsclinic --quiet

# 正しいDATABASE_URLで再作成
CORRECT_DB_URL="postgresql://app_user:PASSWORD@/creative_flow_studio?host=/cloudsql/dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql"
echo -n "$CORRECT_DB_URL" | \
  gcloud secrets create secret-alias-1 \
  --project=dataanalyticsclinic \
  --replication-policy="automatic" \
  --data-file=-
```

### 3. Cloud Runサービスの環境変数設定

```bash
# Cloud RunサービスのDATABASE_URL環境変数を更新
gcloud run services update creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --update-secrets=DATABASE_URL=secret-alias-1:latest
```

### 4. デバッグエンドポイントの追加

`/api/debug/env`エンドポイントを追加して、実行時に環境変数を確認できるようにしました。

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

### デバッグエンドポイントでの確認

```bash
curl https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/api/debug/env | jq '.environment'
```

**期待される結果**:
```json
{
  "DATABASE_URL_SET": true,
  "DATABASE_URL_MASKED": "postgresql://app_user:****@/creative_flow_studio?host=/cloudsql/...",
  "IS_LOCALHOST": false
}
```

---

## ⚠️ 重要な注意事項

### Next.jsのビルドプロセスと環境変数

**Next.jsのビルドプロセス**では、サーバーサイドコードは実行時に読み込まれますが、**ビルド時に環境変数が設定されていると、それがハードコードされる可能性があります**。

**解決策**:
- ビルド時に`DATABASE_URL`を設定しない
- 実行時のみ`DATABASE_URL`を設定する（Cloud Runの環境変数として）

### Prisma Clientの初期化

**Prisma Client**は実行時に`process.env.DATABASE_URL`を読み込みますが、**ビルド時に`DATABASE_URL`が設定されていると、それが保持される可能性があります**。

**解決策**:
- ビルド時に`DATABASE_URL`を設定しない
- 実行時のみ`DATABASE_URL`を設定する

---

## 🔗 関連ドキュメント

- `docs/database-connection-fix-summary.md` - データベース接続エラー解決サマリ
- `docs/auth-callback-error-fix.md` - OAuth Callback エラー解決レポート
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Prisma - Connection URLs](https://www.prisma.io/docs/concepts/database-connectors/postgresql#connection-url)

---

**最終更新**: 2025-11-18  
**担当**: Cursor (JavaSE-21 LTS)

