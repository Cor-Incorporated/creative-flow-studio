# Google OAuth 設定ガイド（Cloud Run dev環境）

**最終更新:** 2025-11-17  
**対象環境:** Cloud Run (dev)  
**目的:** Google OAuth の invalid_client エラーを解消し、ログイン機能を有効化

---

## 問題の概要

**現象**: Cloud Run dev環境でログイン時に `invalid_client` エラーが発生

**原因**:
- Google OAuth の Authorized redirect URI が未登録
- Secret Manager の Google Client ID/Secret が正しく設定されていない可能性

---

## 解決手順

### Phase 1: Google Cloud Console での設定

1. **Google Cloud Console にアクセス**
   - [認証情報ページ](https://console.cloud.google.com/apis/credentials?project=dataanalyticsclinic) にアクセス

2. **OAuth 2.0 クライアント ID の確認/作成**
   - 既存のクライアント ID がある場合は編集
   - ない場合は「認証情報を作成」→「OAuth クライアント ID」を選択

3. **承認済みのリダイレクト URI を追加**
   
   以下の URI を追加：
   ```
   https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/api/auth/callback/google
   ```
   
   **ローカル開発用（オプション）:**
   ```
   http://localhost:3000/api/auth/callback/google
   ```

4. **承認済みの JavaScript 生成元を追加**
   
   以下の URL を追加：
   ```
   https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app
   ```
   
   **ローカル開発用（オプション）:**
   ```
   http://localhost:3000
   ```

5. **Client ID と Client Secret をコピー**
   - 後で Secret Manager に登録します

---

### Phase 2: Secret Manager への登録

#### 既存シークレットの確認

```bash
# 現在の値を確認
gcloud secrets versions access latest --secret=google-client-id --project=dataanalyticsclinic
gcloud secrets versions access latest --secret=google-client-secret --project=dataanalyticsclinic
```

#### シークレットの更新（必要に応じて）

```bash
# Google Client ID を更新
echo -n "YOUR_GOOGLE_CLIENT_ID" | \
  gcloud secrets versions add google-client-id \
  --project=dataanalyticsclinic \
  --data-file=-

# Google Client Secret を更新
echo -n "YOUR_GOOGLE_CLIENT_SECRET" | \
  gcloud secrets versions add google-client-secret \
  --project=dataanalyticsclinic \
  --data-file=-
```

**注意**: `YOUR_GOOGLE_CLIENT_ID` と `YOUR_GOOGLE_CLIENT_SECRET` を実際の値に置き換えてください。

---

### Phase 3: Cloud Run 環境変数の確認

Cloud Run サービスが Secret Manager から正しく値を取得しているか確認：

```bash
gcloud run services describe creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --format="yaml(spec.template.spec.containers[0].env)" | \
  grep -E "(GOOGLE|NEXTAUTH)"
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
- name: NEXTAUTH_URL
  value: https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app
- name: NEXTAUTH_SECRET
  valueFrom:
    secretKeyRef:
      key: latest
      name: nextauth-secret
```

---

### Phase 4: 動作確認

1. **Cloud Run の URL にアクセス**
   ```
   https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app
   ```

2. **ランディングページが表示されることを確認**
   - 未ログイン時はランディングページが表示される
   - 「Googleでログイン」ボタンが表示される

3. **ログインフローの確認**
   - 「Googleでログイン」ボタンをクリック
   - Google アカウントでログイン
   - `invalid_client` エラーが発生しないことを確認
   - ログイン後、チャットUIが表示されることを確認

4. **セッション API の確認**
   ```bash
   # ログイン後、セッション情報を取得
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

**解決策:**
1. Google Cloud Console で OAuth クライアント設定を再確認
2. リダイレクト URI が正確に一致しているか確認（末尾のスラッシュ、プロトコルなど）
3. Secret Manager の値を再確認
4. Cloud Run サービスを再デプロイ

### 問題 2: ログイン後もセッションが生成されない

**原因候補:**
- `NEXTAUTH_URL` が正しく設定されていない
- `NEXTAUTH_SECRET` が設定されていない
- Cookie が正しく設定されていない

**解決策:**
1. Cloud Run の環境変数を確認
2. `NEXTAUTH_URL` が Cloud Run の URL と一致しているか確認
3. Cloud Run ログでエラーを確認：
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=creative-flow-studio-dev" \
     --project=dataanalyticsclinic \
     --limit=50 \
     --format="table(timestamp,severity,textPayload)"
   ```

### 問題 3: ランディングページが表示されない

**原因候補:**
- セッション状態の判定が正しく動作していない
- NextAuth の設定に問題がある

**解決策:**
1. ブラウザの開発者ツールでセッション状態を確認
2. `/api/auth/session` のレスポンスを確認
3. Cloud Run ログでエラーを確認

---

## チェックリスト

設定前:
- [ ] Google Cloud Console で OAuth 2.0 クライアント ID を作成/確認
- [ ] Authorized redirect URI を設定
- [ ] Authorized JavaScript origins を設定
- [ ] Client ID と Client Secret をコピー

設定後:
- [ ] Secret Manager に Client ID/Secret を登録
- [ ] Cloud Run の環境変数を確認
- [ ] ランディングページが表示されることを確認
- [ ] ログインフローが正常に動作することを確認
- [ ] セッション API が正常に動作することを確認

---

## 参考資料

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)


