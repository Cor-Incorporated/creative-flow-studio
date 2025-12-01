# Google OAuth リダイレクトURI手動設定ガイド

**作成日**: 2025-12-01  
**重要**: この設定を行わないと、Googleログインが「このアプリのリクエストは無効です」エラーで失敗します。

---

## 📝 手動設定手順

### ステップ1: Google Cloud Consoleにアクセス

以下のURLにアクセスしてください：
```
https://console.cloud.google.com/apis/credentials?project=dataanalyticsclinic
```

### ステップ2: OAuth 2.0クライアントIDを選択

1. 「OAuth 2.0 クライアント ID」セクションを開く
2. 以下のClient IDをクリックして編集：
   ```
   667780715339-45a76cdu34shn8rnqqn7fvr9682v1bcg.apps.googleusercontent.com
   ```

### ステップ3: 承認済みのリダイレクト URIを追加

「承認済みのリダイレクト URI」セクションで、**以下をすべて追加**してください：

```
https://creative-flow-studio-dev-667780715339.asia-northeast1.run.app/api/auth/callback/google
https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/api/auth/callback/google
https://blunaai.com/api/auth/callback/google
http://localhost:3000/api/auth/callback/google
```

**重要**: 
- 既存のURIがある場合は、削除せずに追加してください
- プロトコル（https）、ドメイン、パスが正確に一致している必要があります
- 末尾のスラッシュ（/）は不要です

### ステップ4: 承認済みの JavaScript 生成元を追加

「承認済みの JavaScript 生成元」セクションで、**以下をすべて追加**してください：

```
https://creative-flow-studio-dev-667780715339.asia-northeast1.run.app
https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app
https://blunaai.com
http://localhost:3000
```

**重要**:
- プロトコル（https）を含めてください
- 末尾のスラッシュ（/）は不要です

### ステップ5: 保存

「保存」ボタンをクリックして設定を保存します。

---

## ✅ 設定後の確認

設定が完了したら、以下で確認できます：

1. **Cloud Run URLからログイン**:
   - https://creative-flow-studio-dev-667780715339.asia-northeast1.run.app/auth/signin
   - または https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/auth/signin
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
   - Adminページ（/admin）にアクセスできることを確認

---

## 🔧 現在の設定状況

- ✅ NextAuth.jsの設定を修正（trustHost削除）
- ✅ NEXTAUTH_URLを`https://blunaai.com`に更新（Cloud Runサービス）
- ✅ Adminユーザーを作成（kotaro.uchiho@gmail.com）
- ⏳ Google OAuthリダイレクトURIの設定（**手動設定が必要**）

---

## ⚠️ トラブルシューティング

### エラー: 「このアプリのリクエストは無効です」

**原因**: リダイレクトURIが正しく登録されていない

**解決策**:
1. Google Cloud ConsoleでリダイレクトURIを確認
2. 両方のURL（Cloud Run URLとカスタムドメイン）が追加されているか確認
3. プロトコル、ドメイン、パスが正確に一致しているか確認

### エラー: redirect_uri_mismatch

**原因**: リダイレクトURIが一致していない

**解決策**:
1. エラーメッセージに表示されているリダイレクトURIを確認
2. そのURIをGoogle Cloud Consoleに追加

---

## 📋 チェックリスト

- [ ] Google Cloud ConsoleでOAuth 2.0クライアントIDを選択
- [ ] 承認済みのリダイレクトURIに3つのURIを追加
- [ ] 承認済みのJavaScript生成元に3つのURLを追加
- [ ] 保存をクリック
- [ ] Cloud Run URLからログインをテスト
- [ ] カスタムドメインからログインをテスト
- [ ] Adminユーザーでログインをテスト

---

**設定が完了するまで、Googleログインは動作しません。**
