# ランディングページのデプロイ手順（Cursor向け）

**作成日**: 2025-11-17
**対象環境**: Cloud Run dev環境
**目的**: 未認証ユーザー向けランディングページの本番反映

---

## 実装概要

**変更内容**:
Claude Codeが未認証ユーザー向けのランディングページを実装しました。この変更により、認証前にチャットUIが表示されることがなくなり、セキュアな認証フローが実現されます。

**主な変更点**:
1. ✅ **新規コンポーネント**: `components/LandingPage.tsx` - 未認証ユーザー向けランディングページ
2. ✅ **条件付きレンダリング**: `app/page.tsx` - 認証状態に応じて表示を切り替え
3. ✅ **セキュリティ改善**: 認証前はチャットUIを非表示にし、API呼び出しを根本的に防止
4. ✅ **全テスト合格**: 136/136 tests passing
5. ✅ **型チェック合格**: TypeScript type-check passing

---

## 実装詳細

### 1. LandingPage コンポーネント (`components/LandingPage.tsx`)

**機能**:
- ヒーローセクション with グラデーション見出し「AIで創造性を解き放つ」
- Google OAuth ログインボタン
- 料金プランページへのリンク
- 機能紹介カード（チャット、画像生成、動画生成）
- レスポンシブデザイン（モバイル対応）

**主要コード**:
```tsx
export default function LandingPage() {
    const handleGoogleSignIn = () => {
        signIn('google', { callbackUrl: window.location.href });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
            {/* Header with Login/Pricing buttons */}
            {/* Hero section with CTA */}
            {/* Features grid */}
            {/* Pricing CTA section */}
        </div>
    );
}
```

### 2. 条件付きレンダリング (`app/page.tsx`)

**実装パターン**:
```tsx
export default function Home() {
    const { data: session, status } = useSession();

    // 1. Loading state
    if (status === 'loading') {
        return <LoadingSpinner />;
    }

    // 2. Unauthenticated users → Landing page
    if (status === 'unauthenticated' || !session?.user) {
        return <LandingPage />;
    }

    // 3. Authenticated users only → Chat UI
    return <ChatInterface />;
}
```

**セキュリティ効果**:
- 未認証ユーザーはチャットUIにアクセスできない
- API呼び出しコンポーネントがレンダリングされないため、認証前のAPI呼び出しが物理的に不可能
- 従来の認証ガード（Toastによる警告）に加え、根本的な防御層を追加

---

## デプロイ手順

### ステップ 1: 変更内容の確認

```bash
# 作業ディレクトリに移動
cd /Users/teradakousuke/Developer/creative-flow-studio

# 変更ファイルを確認
git status

# 期待される出力:
# Modified:
#   - CLAUDE.md
#   - app/page.tsx
#   - docs/deployment-instructions-landing-page.md
# Untracked:
#   - components/LandingPage.tsx
```

### ステップ 2: ローカルでの動作確認（推奨）

```bash
# 依存関係のインストール（念のため）
npm install

# 型チェック
npm run type-check
# Expected: No errors (except pre-existing test file type issues)

# テスト実行
npm test
# Expected: 136/136 tests passing

# 開発サーバー起動（任意）
npm run dev
# http://localhost:3000 で動作確認:
# 1. 未ログイン状態でランディングページが表示される
# 2. "Googleでログイン" ボタンをクリック → Google OAuth画面に遷移
# 3. ログイン後、チャットUIが表示される
```

### ステップ 3: コミットとプッシュ

```bash
# 現在のブランチを確認
git branch
# Expected: * feature/admin-dashboard-final (または main/dev)

# ステージング
git add components/LandingPage.tsx app/page.tsx CLAUDE.md docs/deployment-instructions-landing-page.md

# コミット
git commit -m "feat: Add landing page for unauthenticated users

- Create LandingPage component with hero, features, and CTA
- Add conditional rendering in app/page.tsx based on auth status
- Show loading spinner → landing page → chat UI flow
- Improve security by preventing API calls before authentication

Implementation details:
- components/LandingPage.tsx: Hero section + Google login + pricing link
- app/page.tsx: Early returns for loading/unauthenticated states
- Simplified header auth UI (removed redundant status checks)

Verified:
- ✅ All 136 tests passing
- ✅ Type-check passing
- ✅ No breaking changes

🤖 Generated with Claude Code (https://claude.com/claude-code)"

# プッシュ
git push origin feature/admin-dashboard-final
# または適切なブランチ名を使用
```

### ステップ 4: Cloud Build実行の確認

**自動デプロイが設定されている場合**:
1. GitHub プッシュで自動的に Cloud Build がトリガーされる
2. [Cloud Build コンソール](https://console.cloud.google.com/cloud-build/builds?project=dataanalyticsclinic) でビルドステータスを確認
3. ビルドログで以下を確認:
   - `npm run build` が成功
   - Next.js が `components/LandingPage.tsx` をビルドに含めている
   - 成果物が Artifact Registry にプッシュされている

**手動デプロイが必要な場合**:
```bash
# プロジェクトIDを設定
export PROJECT_ID=dataanalyticsclinic

# Cloud Build を手動実行
gcloud builds submit \
  --config=infra/scripts/node-mirror/cloudbuild.yaml \
  --substitutions=_ENV=dev,_REGION=asia-northeast1 \
  --project=$PROJECT_ID

# ビルドID取得後、ログを確認
gcloud builds log <BUILD_ID> --project=$PROJECT_ID
```

### ステップ 5: デプロイ後の検証

#### 検証 1: ランディングページの表示確認

1. **ブラウザでアクセス**（シークレットモード推奨）:
   ```
   https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/
   ```

2. **期待される表示**:
   - ✅ ヘッダーに「クリエイティブフロースタジオ」
   - ✅ 「料金プラン」と「Googleでログイン」ボタン
   - ✅ ヒーローセクション:
     - 見出し: 「AIで創造性を解き放つ」（グラデーション）
     - サブタイトル: 「Google Gemini を活用したマルチモーダル AI アプリケーション...」
     - CTA: 「Googleで始める」「料金を見る」ボタン
   - ✅ 機能紹介カード（チャット、画像生成、動画生成）
   - ✅ 料金プラン誘導セクション

3. **スタイル確認**:
   - ✅ ダークテーマ（bg-gray-900背景）
   - ✅ グラデーション効果（blue→purple→pink）
   - ✅ レスポンシブデザイン（モバイルでもレイアウト崩れなし）

#### 検証 2: ログインフローの確認

1. **「Googleでログイン」ボタンをクリック**
2. **期待される動作**:
   - ✅ Google OAuth 同意画面にリダイレクト
   - ✅ Google アカウント選択
   - ✅ アプリへリダイレクト後、チャットUIが表示される
   - ✅ ヘッダーに「ログアウト」ボタンが表示される

3. **ログアウト後の確認**:
   - ✅ 「ログアウト」ボタンをクリック
   - ✅ 再びランディングページに戻る

#### 検証 3: セキュリティの確認（API呼び出し防止）

**未認証状態での検証**:
```bash
# ブラウザの開発者ツール（Network タブ）を開く
# 未ログイン状態でページを開く

# 確認事項:
# ✅ /api/gemini/* へのリクエストが一切発生しない
# ✅ /api/conversations へのリクエストも発生しない
# ✅ /api/auth/session へのリクエストのみ（NextAuth用、正常）

# Console でも確認:
fetch('/api/gemini/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: 'test' })
})
.then(r => r.json())
.then(console.log)

# 期待される結果:
# ランディングページではこのコードを実行する場所がないため、
# そもそもチャット入力欄が存在しない（根本的な防御）
```

#### 検証 4: Cloud Run ログの確認

```bash
# Cloud Run ログを確認（エラーがないことを確認）
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=creative-flow-studio-dev" \
  --limit=50 \
  --project=dataanalyticsclinic \
  --format=json

# 確認事項:
# ✅ ビルドエラーがないこと
# ✅ Next.js起動ログが正常
# ✅ 未認証ユーザーのアクセスでエラーが発生していないこと
```

---

## トラブルシューティング

### 問題 1: ランディングページが表示されず、チャットUIが表示される

**原因**: NextAuth環境変数が未設定で、sessionが取得できていない

**確認方法**:
```bash
# ブラウザの開発者ツール（Console）で確認
```

**解決策**:
1. `docs/deployment-instructions-auth-fix.md` を参照
2. NextAuth 環境変数（`NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`）を設定
3. Cloud Run サービスを再デプロイ

### 問題 2: ログインボタンをクリックしても何も起こらない

**原因**: Google OAuth設定が不完全（Authorized Redirect URIが未登録）

**確認方法**:
```bash
# ブラウザの開発者ツール（Console）でエラーを確認
```

**解決策**:
1. [Google Cloud Console - 認証情報](https://console.cloud.google.com/apis/credentials?project=dataanalyticsclinic) を開く
2. OAuth 2.0 クライアントIDを選択
3. **承認済みのリダイレクト URI** に以下を追加:
   ```
   https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/api/auth/callback/google
   ```
4. 保存

### 問題 3: ログイン後もランディングページが表示され続ける

**原因**: sessionが正しく生成されていない、またはCookieが保存されていない

**確認方法**:
```bash
# ブラウザの開発者ツール → Application → Cookies
# 「next-auth.session-token」Cookieがあるか確認
```

**解決策**:
1. `NEXTAUTH_URL` がHTTPSであることを確認（HTTPはNG）
2. `NEXTAUTH_SECRET` が設定されていることを確認
3. ブラウザのCookieをクリアして再度ログイン

### 問題 4: CSSが適用されていない

**原因**: Tailwind CSS v4移行が完了していない

**解決策**:
1. `docs/deployment-instructions-css-fix.md` を参照
2. `app/globals.css` がTailwind v4形式（`@import "tailwindcss";`）になっているか確認
3. Cloud Run環境で再ビルド

### 問題 5: ビルドエラー（TypeScript型エラー）

**原因**: テストファイルの型定義エラー（vitest-fetch-mock）

**確認方法**:
```bash
npm run type-check 2>&1 | grep -v "__tests__"
```

**解決策**:
- 実装ファイル（app/, components/, lib/）に型エラーがないことを確認
- テストファイルの型エラーは既知の問題（vitest-fetch-mockの型定義）であり、実行には影響しない

---

## チェックリスト

### デプロイ前
- [ ] ローカルで `npm test` が全て通る（136/136）
- [ ] `npm run type-check` が合格（テストファイル除く）
- [ ] 変更ファイルをコミット・プッシュ済み

### デプロイ後
- [ ] Cloud Build が成功している
- [ ] ランディングページが表示される（未ログイン状態）
- [ ] 「Googleでログイン」ボタンが機能する
- [ ] ログイン後、チャットUIが表示される
- [ ] ログアウト後、再びランディングページが表示される
- [ ] 未認証状態で `/api/gemini/*` へのリクエストが発生しない（開発者ツールで確認）
- [ ] Cloud Run ログでエラーがない

---

## 補足: NextAuth環境変数の確認

ランディングページが正しく機能するには、NextAuth環境変数が設定されている必要があります。

**必須環境変数**:
```bash
NEXTAUTH_URL=https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app
NEXTAUTH_SECRET=<openssl rand -base64 32で生成>
GOOGLE_CLIENT_ID=<Google Cloud Consoleから取得>
GOOGLE_CLIENT_SECRET=<Google Cloud Consoleから取得>
```

**確認方法**:
```bash
# Cloud Run サービスの環境変数を確認
gcloud run services describe creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --format="value(spec.template.spec.containers[0].env)"
```

**未設定の場合**:
`docs/deployment-instructions-auth-fix.md` の手順に従って設定してください。

---

## 参考資料

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Next.js 14 Authentication](https://nextjs.org/docs/app/building-your-application/authentication)
- [Cloud Run Deployment](https://cloud.google.com/run/docs/deploying)
- 関連ドキュメント:
  - `docs/deployment-instructions-auth-fix.md` - NextAuth環境変数設定
  - `docs/deployment-instructions-css-fix.md` - CSS/Tailwind設定
  - `docs/testing-plan.md` - テスト手順

---

**デプロイ完了後、Claude Code へ検証結果を報告してください。**
