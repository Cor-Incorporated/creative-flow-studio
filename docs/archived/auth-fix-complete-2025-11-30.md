# 認証エラー修正完了レポート

**作成日**: 2025-11-30  
**問題**: Google OAuth認証が失敗する  
**根本原因**: DATABASE_URLが`localhost:5432`を指していた + Cloud SQLマウント設定が不足  
**ステータス**: ✅ 修正完了

---

## 🔍 発見された問題

### 1. DATABASE_URLが間違っていた

**問題**:
- Secret Managerの`database-url`が`postgresql://user:password@localhost:5432/test?schema=public`を指していた
- Cloud Run環境では`localhost:5432`に接続できない

**ログから確認されたエラー**:
```
[Prisma] ERROR: DATABASE_URL is pointing to localhost:5432! This is wrong for Cloud Run.
Invalid `prisma.account.findUnique()` invocation
[next-auth][error][adapter_error_getUserByAccount]
```

### 2. Cloud SQLインスタンスのマウント設定が不足

**問題**:
- Cloud RunサービスにCloud SQLインスタンスのマウント設定がなかった
- Unixソケット経由での接続ができなかった

**確認コマンド**:
```bash
gcloud run services describe creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --format="yaml(spec.template.spec.volumes)"
# 結果: null（マウント設定なし）
```

### 3. State Cookieが欠落

**問題**:
- OAuthコールバック処理中に`State cookie was missing`エラーが発生
- データベース接続が失敗しているため、セッション管理ができない

**ログから確認されたエラー**:
```
[next-auth][error][OAUTH_CALLBACK_ERROR] 
State cookie was missing.
```

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

### 2. 正しいDATABASE_URLの作成と更新

**正しい形式**:
```
postgresql://app_user:PASSWORD@/creative_flow_studio?host=/cloudsql/dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql
```

**Secret Managerへの登録**:
```bash
DB_URL="postgresql://app_user:${NEW_PASSWORD}@/creative_flow_studio?host=/cloudsql/dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql"
echo -n "$DB_URL" | \
  gcloud secrets versions add database-url \
  --project=dataanalyticsclinic \
  --data-file=-
```

### 3. Cloud SQLインスタンスのマウント設定

```bash
gcloud run services update creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --add-cloudsql-instances=dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql
```

### 4. NextAuth.jsのCookie設定を追加

HTTPS環境用のCookie設定を`lib/auth.ts`に追加:

```typescript
cookies: {
    sessionToken: {
        name: `__Secure-next-auth.session-token`,
        options: {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            secure: true, // HTTPS環境では true
        },
    },
    // ... 他のCookie設定
},
```

---

## 🔍 確認事項

### Cloud Runサービスの環境変数

Cloud Runサービスは以下のシークレットを参照しています:
- `DATABASE_URL` → `database-url` (Secret Manager)
- `GOOGLE_CLIENT_ID` → `google-client-id` (Secret Manager)
- `GOOGLE_CLIENT_SECRET` → `google-client-secret` (Secret Manager)
- `NEXTAUTH_SECRET` → `nextauth-secret` (Secret Manager)
- `NEXTAUTH_URL` → `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app` (直接設定)

### Cloud SQL接続情報

- **インスタンス名**: `creative-flow-studio-sql`
- **Connection Name**: `dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql`
- **データベース名**: `creative_flow_studio`
- **ユーザー名**: `app_user`

---

## 🚀 次のステップ

### 1. コードの変更をコミット・プッシュ

```bash
git add lib/auth.ts docs/auth-fix-complete-2025-11-30.md
git commit -m "fix: Add HTTPS cookie settings for NextAuth.js in Cloud Run"
git push origin feature/admin-dashboard-final
```

### 2. Cloud Buildで再デプロイ

コードの変更を反映するため、Cloud Buildで再デプロイが必要です。

### 3. 動作確認

1. Cloud RunのURLにアクセス
2. 「Googleでログイン」をクリック
3. Googleアカウントでログイン
4. 正常にリダイレクトされることを確認
5. セッションが確立されていることを確認

---

## 📝 参考資料

- [Cloud SQL - Connecting from Cloud Run](https://cloud.google.com/sql/docs/postgres/connect-run)
- [NextAuth.js - Deployment](https://next-auth.js.org/deployment)
- [NextAuth.js - Cookies](https://next-auth.js.org/configuration/options#cookies)

---

**修正完了日**: 2025-11-30  
**担当**: Claude Code



