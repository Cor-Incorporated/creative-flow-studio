# NextAuth.js Cloud Run 設定ガイド

**最終更新:** 2025-11-17  
**対象環境:** Cloud Run (dev)  
**目的:** NextAuth.js が Cloud Run 環境で正常に動作するための設定手順

---

## ✅ 設定完了状況

### Cloud Run 環境変数

以下の環境変数が Cloud Run サービス `creative-flow-studio-dev` に設定済み：

| 環境変数名 | 値 | 設定方法 |
|----------|-----|---------|
| `NEXTAUTH_URL` | `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app` | 直接設定 |
| `NEXTAUTH_SECRET` | Secret Manager (`nextauth-secret`) | Secret Manager から注入 |
| `GOOGLE_CLIENT_ID` | Secret Manager (`google-client-id`) | Secret Manager から注入 |
| `GOOGLE_CLIENT_SECRET` | Secret Manager (`google-client-secret`) | Secret Manager から注入 |
| `DATABASE_URL` | Secret Manager (`database-url`) | Secret Manager から注入 |
| `CANONICAL_HOST` | 例: `blunaai.com` | 直接設定（カスタムドメイン運用時のみ） |

### Secret Manager シークレット

以下のシークレットが Secret Manager に登録済み：

- ✅ `nextauth-secret`
- ✅ `google-client-id`
- ✅ `google-client-secret`
- ✅ `database-url`

---

## Google OAuth 設定

### 1. Google Cloud Console での設定

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) にアクセス
2. **認証情報** → **OAuth 2.0 クライアント ID** を選択
3. 既存のクライアント ID を編集、または新規作成

### 2. 承認済みのリダイレクト URI

以下の URI を **承認済みのリダイレクト URI** に追加：

```
https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/api/auth/callback/google
```

**カスタムドメイン運用時（必須）:**
```
https://blunaai.com/api/auth/callback/google
```

**ローカル開発用（オプション）:**
```
http://localhost:3000/api/auth/callback/google
```

### 3. 承認済みの JavaScript 生成元

以下の URL を **承認済みの JavaScript 生成元** に追加：

```
https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app
```

**ローカル開発用（オプション）:**
```
http://localhost:3000
```

---

## NextAuth.js 設定の確認

### `lib/auth.ts` の設定

```typescript
export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
    ],
    session: {
        strategy: 'database',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        updateAge: 24 * 60 * 60, // 24 hours
    },
    // ...
};
```

### 重要な設定項目

1. **`NEXTAUTH_URL`**: Cloud Run の URL を設定（必須）
2. **`NEXTAUTH_SECRET`**: セッション暗号化用のシークレット（必須）
3. **`GOOGLE_CLIENT_ID`**: Google OAuth クライアント ID（必須）
4. **`GOOGLE_CLIENT_SECRET`**: Google OAuth クライアントシークレット（必須）
5. **`DATABASE_URL`**: Prisma Adapter 用のデータベース接続文字列（必須）
6. **`CANONICAL_HOST`**: カスタムドメイン配下で `X-Forwarded-Host` を優先して正規ホストへ収束させる（OAuth state cookie mismatch / 308ループ回避）

---

## セッション動作の検証

### 1. ログイン動作確認

1. Cloud Run の URL にアクセス: `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app`
2. **ログイン** ボタンをクリック
3. Google アカウントでログイン
4. リダイレクト後、セッションが確立されていることを確認

### 2. セッション API の確認

```bash
# セッション情報を取得（認証後）
curl -b cookies.txt https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/api/auth/session
```

**期待される結果:**
```json
{
  "user": {
    "id": "...",
    "email": "...",
    "name": "...",
    "image": "...",
    "role": "USER"
  },
  "expires": "..."
}
```

### 3. 保護された API の確認

```bash
# チャット API を呼び出し（認証後）
curl -b cookies.txt -X POST https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/api/gemini/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "こんにちは"}'
```

**期待される結果:** 200 OK（認証済みの場合）

---

## トラブルシューティング

### 問題 1: ログイン後も 401 エラーが発生する

**原因候補:**
- `NEXTAUTH_URL` が正しく設定されていない
- Google OAuth のリダイレクト URI が一致していない
- Cookie が正しく設定されていない（SameSite 設定）

**解決策:**
1. Cloud Run の環境変数を確認：
   ```bash
   gcloud run services describe creative-flow-studio-dev \
     --region=asia-northeast1 \
     --project=dataanalyticsclinic \
     --format="get(spec.template.spec.containers[0].env)"
   ```

2. Google OAuth 設定を確認：
   - リダイレクト URI が正確に一致しているか確認
   - クライアント ID/シークレットが正しいか確認

3. Cloud Run ログを確認：
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=creative-flow-studio-dev" \
     --project=dataanalyticsclinic \
     --limit=50 \
     --format="table(timestamp,severity,textPayload)"
   ```

### 問題 2: セッションが生成されない

**原因候補:**
- Prisma Adapter が正しく動作していない
- データベース接続エラー
- セッションテーブルが存在しない

**解決策:**
1. データベース接続を確認：
   ```bash
   # Cloud SQL Proxy 経由で接続
   psql -h localhost -p 5432 -U app_user -d creative_flow_studio
   ```

2. セッションテーブルの存在を確認：
   ```sql
   SELECT * FROM "Session" LIMIT 5;
   ```

3. Prisma マイグレーションを確認：
   ```bash
   npx prisma migrate status
   ```

### 問題 3: Cookie が設定されない

**原因候補:**
- HTTPS 設定の問題
- SameSite Cookie 設定の問題
- ドメイン設定の問題

**解決策:**
1. NextAuth.js の設定に `useSecureCookies` を追加（HTTPS 環境の場合）：
   ```typescript
   export const authOptions: NextAuthOptions = {
       // ...
       cookies: {
           sessionToken: {
               name: `__Secure-next-auth.session-token`,
               options: {
                   httpOnly: true,
                   sameSite: 'lax',
                   path: '/',
                   secure: true, // HTTPS 環境では true
               },
           },
       },
   };
   ```

2. Cloud Run の HTTPS 設定を確認：
   - Cloud Run は自動的に HTTPS を提供
   - カスタムドメインを使用している場合は、SSL 証明書の設定を確認

---

## 参考資料

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [NextAuth.js Deployment](https://next-auth.js.org/deployment)
- [Google OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)
- [Prisma Adapter](https://next-auth.js.org/v4/adapters/prisma)

---

## チェックリスト

設定前:
- [ ] Google Cloud Console で OAuth クライアント ID を作成
- [ ] 承認済みのリダイレクト URI を設定
- [ ] Secret Manager にシークレットを登録

設定後:
- [ ] Cloud Run の環境変数を確認
- [ ] ログイン動作を確認
- [ ] セッション API が正常に動作することを確認
- [ ] 保護された API が正常に動作することを確認


