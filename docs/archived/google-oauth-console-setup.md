# Google OAuth 2.0 設定手順（Google Cloud Console）

**最終更新:** 2025-11-17  
**対象環境:** Cloud Run (dev)  
**目的:** NextAuth.js で使用する Google OAuth 2.0 クライアントIDの作成と設定

---

## ⚠️ 重要な注意事項

**gcloudコマンドではOAuth 2.0クライアントIDを直接作成できません。**

OAuth 2.0クライアントIDの作成は、**Google Cloud ConsoleのUI**から行う必要があります。  
gcloudコマンドは設定の確認やSecret Managerへの登録に使用します。

---

## 現在の設定状況

### Secret Manager の確認

```bash
# 現在の値を確認
gcloud secrets versions access latest --secret=google-client-id --project=dataanalyticsclinic
gcloud secrets versions access latest --secret=google-client-secret --project=dataanalyticsclinic
```

**現在の状態:**
- `google-client-id`: `test-google-client-id` (プレースホルダーの可能性)
- `google-client-secret`: 設定済み（26文字）

---

## 手順 1: Google Cloud Console で OAuth 2.0 クライアントIDを作成

### 1.1 Google Cloud Console にアクセス

以下のURLにアクセスしてください：

```
https://console.cloud.google.com/apis/credentials?project=dataanalyticsclinic
```

または、以下のコマンドでブラウザを開きます：

```bash
open https://console.cloud.google.com/apis/credentials?project=dataanalyticsclinic
```

### 1.2 OAuth同意画面の設定（初回のみ）

1. 左側のメニューから **「OAuth同意画面」** を選択
2. **「ユーザータイプ」** を選択：
   - **外部**（一般ユーザー向け）を推奨
   - **内部**（Google Workspace組織内のみ）は組織アカウントが必要
3. 必要な情報を入力：
   - **アプリ名**: `BlunaAI`
   - **ユーザーサポートメール**: あなたのメールアドレス
   - **開発者の連絡先情報**: あなたのメールアドレス
4. **「保存して次へ」** をクリック
5. スコープ設定（デフォルトのままでOK）→ **「保存して次へ」**
6. テストユーザー（必要に応じて追加）→ **「保存して次へ」**
7. **「ダッシュボードに戻る」** をクリック

### 1.3 OAuth 2.0 クライアントIDの作成

1. **「認証情報」** タブを選択
2. 上部の **「+ 認証情報を作成」** をクリック
3. **「OAuth クライアント ID」** を選択

4. **「アプリケーションの種類」** を選択：
   - **ウェブアプリケーション** を選択

5. **「名前」** を入力：
   ```
   creative-flow-studio-dev
   ```

6. **「承認済みのリダイレクト URI」** に以下を追加：
   ```
   https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/api/auth/callback/google
   ```
   
   **ローカル開発用（オプション）:**
   ```
   http://localhost:3000/api/auth/callback/google
   ```

7. **「承認済みの JavaScript 生成元」** に以下を追加：
   ```
   https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app
   ```
   
   **ローカル開発用（オプション）:**
   ```
   http://localhost:3000
   ```

8. **「作成」** をクリック

9. **重要**: 表示された **「クライアント ID」** と **「クライアント シークレット」** をコピーしてください
   - この画面を閉じると、シークレットは再表示できません
   - メモ帳などに一時的に保存してください

---

## 手順 2: Secret Manager に登録

### 2.1 Client ID を Secret Manager に登録

```bash
# YOUR_CLIENT_ID を実際のクライアントIDに置き換えてください
echo -n "YOUR_CLIENT_ID" | \
  gcloud secrets versions add google-client-id \
  --project=dataanalyticsclinic \
  --data-file=-
```

**例:**
```bash
echo -n "123456789-abcdefghijklmnop.apps.googleusercontent.com" | \
  gcloud secrets versions add google-client-id \
  --project=dataanalyticsclinic \
  --data-file=-
```

### 2.2 Client Secret を Secret Manager に登録

```bash
# YOUR_CLIENT_SECRET を実際のクライアントシークレットに置き換えてください
echo -n "YOUR_CLIENT_SECRET" | \
  gcloud secrets versions add google-client-secret \
  --project=dataanalyticsclinic \
  --data-file=-
```

**例:**
```bash
echo -n "GOCSPX-abcdefghijklmnopqrstuvwxyz" | \
  gcloud secrets versions add google-client-secret \
  --project=dataanalyticsclinic \
  --data-file=-
```

### 2.3 登録の確認

```bash
# Client ID を確認
echo "Client ID:"
gcloud secrets versions access latest --secret=google-client-id --project=dataanalyticsclinic

# Client Secret の長さを確認（実際の値は表示されません）
echo "Client Secret length:"
gcloud secrets versions access latest --secret=google-client-secret --project=dataanalyticsclinic | wc -c
```

---

## 手順 3: Cloud Run 環境変数の確認

Cloud Run サービスが Secret Manager から正しく値を取得しているか確認：

```bash
gcloud run services describe creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --format="yaml(spec.template.spec.containers[0].env)" | \
  grep -A 5 "GOOGLE_CLIENT"
```

**期待される出力:**
```yaml
- name: GOOGLE_CLIENT_ID
  valueFrom:
    secretKeyRef:
      key: latest
      name: google-client-id
- name: GOOGLE_CLIENT_SECRET
  valueFrom:
    secretKeyRef:
      key: latest
      name: google-client-secret
```

---

## 手順 4: 動作確認

### 4.1 ランディングページの確認

1. ブラウザで以下にアクセス：
   ```
   https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app
   ```

2. **ランディングページが表示されることを確認**
   - 未ログイン時はランディングページが表示される
   - 「Googleでログイン」ボタンが表示される

### 4.2 ログインフローの確認

1. **「Googleでログイン」ボタンをクリック**
2. Google アカウント選択画面が表示されることを確認
3. Google アカウントでログイン
4. **`invalid_client` エラーが発生しないことを確認**
5. ログイン後、チャットUIが表示されることを確認

### 4.3 セッション API の確認

```bash
# ログイン後、ブラウザの開発者ツールで以下を実行
# または curl でセッション情報を取得（Cookieが必要）
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

---

## トラブルシューティング

### 問題 1: invalid_client エラーが続く

**原因候補:**
- Authorized redirect URI が一致していない
- Client ID/Secret が正しく設定されていない
- Secret Manager の値が Cloud Run に反映されていない

**解決策:**
1. Google Cloud Console で OAuth クライアント設定を再確認
   - リダイレクト URI が正確に一致しているか確認（末尾のスラッシュ、プロトコルなど）
2. Secret Manager の値を再確認
3. Cloud Run サービスを再デプロイ（最新のシークレットバージョンを取得）

### 問題 2: OAuth同意画面のエラー

**原因候補:**
- OAuth同意画面が設定されていない
- テストユーザーが追加されていない（外部ユーザータイプの場合）

**解決策:**
1. Google Cloud Console → **「OAuth同意画面」** を確認
2. テストユーザーに自分のメールアドレスを追加
3. アプリを公開するか、テストユーザーとして追加

### 問題 3: リダイレクトURI不一致エラー

**エラーメッセージ例:**
```
redirect_uri_mismatch
```

**解決策:**
1. Google Cloud Console で OAuth クライアント設定を確認
2. リダイレクト URI が以下と完全に一致しているか確認：
   ```
   https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/api/auth/callback/google
   ```
3. プロトコル（https）、ドメイン、パスが正確に一致している必要があります

---

## チェックリスト

設定前:
- [ ] Google Cloud Console にアクセスできる
- [ ] プロジェクト `dataanalyticsclinic` にアクセス権限がある

設定中:
- [ ] OAuth同意画面を設定（初回のみ）
- [ ] OAuth 2.0 クライアントIDを作成
- [ ] 承認済みのリダイレクト URI を設定
- [ ] 承認済みの JavaScript 生成元を設定
- [ ] Client ID と Client Secret をコピー

設定後:
- [ ] Secret Manager に Client ID を登録
- [ ] Secret Manager に Client Secret を登録
- [ ] Cloud Run の環境変数を確認
- [ ] ランディングページが表示されることを確認
- [ ] ログインフローが正常に動作することを確認
- [ ] セッション API が正常に動作することを確認

---

## 参考資料

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
- [OAuth 2.0 for Client-side Web Applications](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)

---

## 補足: gcloudコマンドの制限

**gcloudコマンドではOAuth 2.0クライアントIDを直接作成できません。**

理由:
- OAuth 2.0クライアントIDの作成は、Google Cloud ConsoleのUIまたはREST API経由でのみ可能
- gcloudコマンドにはOAuth 2.0クライアントID作成コマンドが存在しない
- IAP（Identity-Aware Proxy）のOAuthクライアントは別のコマンドだが、NextAuth.jsには使用しない

**推奨方法:**
- Google Cloud ConsoleのUIを使用（最も簡単で確実）
- または、Google Cloud API REST APIを直接呼び出す（高度）


