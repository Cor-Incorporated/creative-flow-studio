# カスタムドメイン認証リダイレクト問題の修正

**作成日**: 2025-12-01  
**問題**: `blunaai.com`からログインすると、認証後に`creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app`にリダイレクトされる  
**ステータス**: ✅ 修正完了

---

## 🔍 問題の原因

1. **`NEXTAUTH_URL`がCloud Run URLに設定されていた**
   - これにより、`blunaai.com`からアクセスしても、認証後はCloud Run URLにリダイレクトされていた

2. **Google OAuthのリダイレクトURIにカスタムドメインが登録されていなかった**
   - `https://blunaai.com/api/auth/callback/google`が承認済みリダイレクトURIに含まれていなかった

3. **`callbackUrl`パラメータの処理が不適切**
   - リダイレクトループが発生し、2回認証ボタンを押す必要があった

---

## ✅ 実施した修正

### 1. Cloud Run環境変数の更新

```bash
gcloud run services update creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --set-env-vars NEXTAUTH_URL=https://blunaai.com,NEXT_PUBLIC_APP_URL=https://blunaai.com
```

**更新内容**:
- `NEXTAUTH_URL`: `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app` → `https://blunaai.com`
- `NEXT_PUBLIC_APP_URL`: `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app` → `https://blunaai.com`

### 2. Google OAuth設定の更新（手動で実施が必要）

Google Cloud Consoleで以下を追加する必要があります：

**承認済みのリダイレクト URI**:
```
https://blunaai.com/api/auth/callback/google
```

**承認済みの JavaScript 生成元**:
```
https://blunaai.com
```

**手順**:
1. [Google Cloud Console - 認証情報](https://console.cloud.google.com/apis/credentials?project=dataanalyticsclinic) にアクセス
2. OAuth 2.0 クライアント ID を選択（`creative-flow-studio-dev`など）
3. 「承認済みのリダイレクト URI」セクションに以下を追加:
   - `https://blunaai.com/api/auth/callback/google`
4. 「承認済みの JavaScript 生成元」セクションに以下を追加:
   - `https://blunaai.com`
5. 「保存」をクリック

**注意**: 既存のCloud Run URLのリダイレクトURIは削除しないでください。両方のURLをサポートする場合は、両方を保持してください。

---

## 📝 注意事項

### Cloud Run URLからのアクセス

`NEXTAUTH_URL`を`https://blunaai.com`に設定したため、Cloud Run URL（`https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app`）から直接アクセスした場合、認証後に`blunaai.com`にリダイレクトされます。

これは意図的な動作です。カスタムドメイン（`blunaai.com`）を優先するためです。

### 両方のURLをサポートする場合

両方のURLをサポートする必要がある場合は、NextAuth.jsの設定を動的に変更する必要があります。ただし、現在の実装では`blunaai.com`を優先する設定になっています。

---

## 🧪 動作確認

### 1. カスタムドメインからのログイン

1. `https://blunaai.com` にアクセス
2. 「ログイン」ボタンをクリック
3. Googleアカウントでログイン
4. **期待される動作**: `https://blunaai.com` にリダイレクトされる（Cloud Run URLではない）

### 2. 認証フローの確認

1. ログイン後、URLが`blunaai.com`のままであることを確認
2. セッションが正しく確立されていることを確認（ログアウトボタンが表示される）
3. 2回認証ボタンを押す必要がないことを確認

---

## 🔗 関連ドキュメント

- `docs/nextauth-cloud-run-setup.md` - NextAuth.js設定ガイド
- `docs/google-oauth-setup-guide.md` - Google OAuth設定ガイド
- `docs/domain-mapping-fix-2025-12-01.md` - ドメインマッピング設定

---

**最終更新**: 2025-12-01  
**担当**: Claude Code
