# Google OAuth「このアプリのリクエストは無効です」エラー修正完了

**作成日**: 2025-12-01  
**ステータス**: ✅ 修正完了（Google Cloud Consoleでの手動設定が必要）

---

## ✅ 完了した修正

### 1. NextAuth.jsの設定を修正
- `trustHost`オプションを削除（NextAuth.js v4には存在しない）
- `lib/auth.ts`を修正

### 2. NEXTAUTH_URLをカスタムドメインに更新
- `infra/envs/dev/terraform.tfvars`で`NEXTAUTH_URL`を`https://blunaai.com`に設定
- Terraform適用が必要（GitHub Actionsで自動実行）

### 3. Adminユーザーを作成
- `kotaro.uchiho@gmail.com`をadmin登録完了
- パスワード: `test12345`
- ロール: `ADMIN`
- スクリプト: `scripts/create-admin-user-cloud-sql.sh`

---

## 📝 必須の手動設定（Google Cloud Console）

Google OAuth 2.0クライアントのリダイレクトURIを手動で設定する必要があります。

### 手順

1. **Google Cloud Consoleにアクセス**:
   ```
   https://console.cloud.google.com/apis/credentials?project=dataanalyticsclinic
   ```

2. **OAuth 2.0 クライアント IDを選択**:
   - Client ID: `667780715339-45a76cdu34shn8rnqqn7fvr9682v1bcg.apps.googleusercontent.com`

3. **「承認済みのリダイレクト URI」に以下を追加**:
   ```
   https://creative-flow-studio-dev-667780715339.asia-northeast1.run.app/api/auth/callback/google
   https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/api/auth/callback/google
   https://blunaai.com/api/auth/callback/google
   http://localhost:3000/api/auth/callback/google
   ```

4. **「承認済みの JavaScript 生成元」に以下を追加**:
   ```
   https://creative-flow-studio-dev-667780715339.asia-northeast1.run.app
   https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app
   https://blunaai.com
   http://localhost:3000
   ```

5. **「保存」をクリック**

---

## ✅ 確認事項

- [x] NextAuth.jsの設定を修正（trustHost削除）
- [x] Adminユーザーを作成（kotaro.uchiho@gmail.com）
- [x] NEXTAUTH_URLをカスタムドメインに更新（Terraform）
- [ ] Google Cloud ConsoleでリダイレクトURIを手動設定（**必須**）
- [ ] 両方のURLからログインできることを確認
- [ ] Adminユーザーでログインできることを確認

---

## 🎯 次のステップ

1. Google Cloud ConsoleでリダイレクトURIを設定
2. Terraformが適用されるのを待つ（GitHub Actionsで自動実行）
3. Cloud Buildが成功するのを待つ
4. 両方のURLからログインをテスト

---

**重要**: Google Cloud ConsoleでリダイレクトURIを設定しない限り、ログインエラーは解決しません。
