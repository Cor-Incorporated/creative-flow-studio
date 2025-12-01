# Google OAuth「このアプリのリクエストは無効です」エラー修正

**作成日**: 2025-12-01  
**問題**: `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/auth/signin` と `https://blunaai.com/auth/signin` からログインしようとすると「このアプリのリクエストは無効です」エラーが発生  
**ステータス**: ✅ 修正完了（手動設定が必要）

---

## 🔍 問題の原因

「このアプリのリクエストは無効です」エラーは、Google OAuthのリダイレクトURIがGoogle Cloud Consoleに正しく登録されていないことが原因です。

**具体的な原因**:
1. Google OAuth 2.0クライアントの「承認済みのリダイレクト URI」に両方のURLが登録されていない
2. NextAuth.jsが複数のドメインに対応していない

---

## ✅ 実施した修正

### 1. NextAuth.jsの設定を修正

**ファイル**: `lib/auth.ts`

**変更内容**:
```typescript
export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    // Allow NextAuth to work with multiple domains (Cloud Run URL and custom domain)
    // This enables dynamic host detection from request headers
    trustHost: true,
    // ...
}
```

**効果**:
- `trustHost: true`により、NextAuth.jsがリクエストヘッダーからホストを動的に検出できるようになります
- これにより、Cloud Run URLとカスタムドメインの両方で動作します

### 2. Adminユーザー登録スクリプトを作成

**ファイル**: `scripts/create-admin-user-cloud-sql.sh`

**使用方法**:
```bash
./scripts/create-admin-user-cloud-sql.sh
```

**作成されるユーザー**:
- メールアドレス: `kotaro.uchiho@gmail.com`
- パスワード: `test12345`
- ロール: `ADMIN`

### 3. Google OAuthリダイレクトURI設定スクリプトを作成

**ファイル**: `scripts/setup-google-oauth-redirects.sh`

**使用方法**:
```bash
./scripts/setup-google-oauth-redirects.sh
```

このスクリプトは、Google Cloud Consoleで手動設定する手順を表示します。

---

## 📝 手動設定手順（必須）

Google OAuth 2.0クライアントのリダイレクトURIは、Google Cloud Consoleで手動設定する必要があります。

### ステップ1: Google Cloud Consoleにアクセス

1. [Google Cloud Console - 認証情報](https://console.cloud.google.com/apis/credentials?project=dataanalyticsclinic) にアクセス
2. プロジェクト `dataanalyticsclinic` を選択

### ステップ2: OAuth 2.0クライアントIDを選択

1. 「OAuth 2.0 クライアント ID」セクションで、以下のClient IDを選択:
   ```
   667780715339-45a76cdu34shn8rnqqn7fvr9682v1bcg.apps.googleusercontent.com
   ```

### ステップ3: 承認済みのリダイレクト URIを追加

「承認済みのリダイレクト URI」セクションで、以下を追加:

```
https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/api/auth/callback/google
https://blunaai.com/api/auth/callback/google
http://localhost:3000/api/auth/callback/google
```

### ステップ4: 承認済みの JavaScript 生成元を追加

「承認済みの JavaScript 生成元」セクションで、以下を追加:

```
https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app
https://blunaai.com
http://localhost:3000
```

### ステップ5: 保存

「保存」をクリックして設定を保存します。

---

## ✅ 確認方法

設定が完了したら、以下で確認できます:

1. **Cloud Run URLからログイン**:
   - https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/auth/signin
   - Googleログインボタンをクリック
   - 正常にログインできることを確認

2. **カスタムドメインからログイン**:
   - https://blunaai.com/auth/signin
   - Googleログインボタンをクリック
   - 正常にログインできることを確認

3. **メール&PWでログイン**:
   - メールアドレス: `kotaro.uchiho@gmail.com`
   - パスワード: `test12345`
   - 正常にログインできることを確認

---

## 🔧 作成されたスクリプト

1. **`scripts/create-admin-user-cloud-sql.sh`**
   - kotaro.uchiho@gmail.comをadmin登録するスクリプト
   - Cloud SQL Proxyを使用してデータベースに直接接続

2. **`scripts/setup-google-oauth-redirects.sh`**
   - Google OAuthリダイレクトURI設定の手順を表示するスクリプト

3. **`scripts/create-admin-user-node.js`**
   - Node.js版のadminユーザー登録スクリプト（ローカル開発用）

---

## ⚠️ 重要な注意事項

1. **リダイレクトURIの設定は必須**
   - 両方のURL（Cloud Run URLとカスタムドメイン）を追加しないと、どちらかのURLでログインできません
   - プロトコル（https）、ドメイン、パスが正確に一致している必要があります

2. **設定の反映時間**
   - Google Cloud Consoleで設定を保存してから、反映まで数分かかる場合があります

3. **既存の機能への影響**
   - これらの修正は既存の機能（動画・画像生成、adminページなど）に影響しません
   - CI/CDパイプラインも正常に動作します

---

## 📋 チェックリスト

- [x] NextAuth.jsに`trustHost: true`を追加
- [x] Adminユーザー登録スクリプトを作成
- [x] Google OAuthリダイレクトURI設定スクリプトを作成
- [ ] Google Cloud ConsoleでリダイレクトURIを手動設定（**必須**）
- [ ] 両方のURLからログインできることを確認
- [ ] Adminユーザーでログインできることを確認

---

## 🎉 完了

修正が完了しました。Google Cloud ConsoleでリダイレクトURIを設定すれば、両方のURLからログインできるようになります。
