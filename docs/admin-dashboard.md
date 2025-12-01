# 管理画面 (Admin Dashboard) ガイド

このドキュメントでは、BlunaAI の管理画面へのアクセス方法と使い方を説明します。

## 概要

管理画面は、アプリケーションの運用管理者向けの機能です。ユーザー管理、利用状況の監視、システム統計の確認ができます。

## アクセス要件

### 必要な権限

管理画面にアクセスするには、ユーザーアカウントの `role` が `ADMIN` に設定されている必要があります。

### アクセスURL

```
https://your-domain.com/admin
```

ローカル開発環境の場合:
```
http://localhost:3000/admin
```

## 管理者アカウントの設定方法

### 方法1: Prisma Studio を使用（推奨・開発環境向け）

1. Prisma Studio を起動:
   ```bash
   npm run prisma:studio
   ```

2. ブラウザで `http://localhost:5555` を開く

3. `User` テーブルを選択

4. 管理者にしたいユーザーの `role` を `ADMIN` に変更

5. 保存をクリック

### 方法2: SQL を直接実行（本番環境向け）

```sql
-- ユーザーのメールアドレスで管理者権限を付与
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

### 方法3: 既存の管理画面から（管理者のみ）

既に管理者アカウントがある場合:

1. 管理画面にログイン
2. 「ユーザー管理」ページに移動
3. 対象ユーザーの「ロール」を「ADMIN」に変更

## 管理画面の機能

### 1. ダッシュボード概要 (`/admin`)

システム全体の統計情報を表示:

- **総ユーザー数**: 登録済みユーザーの総数
- **総会話数**: 作成された会話の総数
- **総メッセージ数**: 送信されたメッセージの総数
- **サブスクリプション数**: プラン別のサブスクリプション数
- **今日の利用ログ**: 本日のAPI利用回数

### 2. ユーザー管理 (`/admin/users`)

ユーザーの一覧表示と管理:

| 項目 | 説明 |
|------|------|
| メールアドレス | ユーザーの登録メール |
| 名前 | ユーザー名 |
| ロール | USER / PRO / ENTERPRISE / ADMIN |
| 作成日 | アカウント作成日 |
| プラン | サブスクリプションプラン |
| ステータス | サブスクリプション状態 |
| 今月のリクエスト数 | 当月のAPI利用回数 |

**操作可能な機能:**
- ユーザー検索（メール/名前）
- ロール変更
- フィルタリング（ロール、プラン、ステータス）

### 3. 利用状況監視 (`/admin/usage`)

API利用ログの確認:

| 項目 | 説明 |
|------|------|
| ユーザー | 実行したユーザー |
| アクション | chat / image / video など |
| リソースタイプ | 使用したモデル |
| 日時 | 実行日時 |
| メタデータ | 詳細情報（展開可能） |

**フィルター機能:**
- ユーザーID
- アクション種別
- 日付範囲

## セキュリティ

### RBAC (Role-Based Access Control)

管理画面は `middleware.ts` によって保護されています:

```typescript
// /admin/* へのアクセス時に実行
if (!token) {
    // 未認証 → ログインページにリダイレクト
    return NextResponse.redirect(new URL('/api/auth/signin', req.url));
}

if (token.role !== 'ADMIN') {
    // 権限不足 → 403 Forbidden
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### アクセスログ

すべての管理画面操作は `AuditLog` テーブルに記録されます。

## トラブルシューティング

### 管理画面にアクセスできない

1. **ログインしているか確認**
   - ログインページ (`/auth/signin`) からログイン

2. **ロールが ADMIN か確認**
   - Prisma Studio でユーザーの `role` を確認
   - `USER` や `PRO` では管理画面にアクセス不可

3. **セッションが有効か確認**
   - ブラウザのCookieをクリアして再ログイン

### 403 Forbidden エラー

- 原因: ユーザーの `role` が `ADMIN` ではない
- 解決: データベースで `role` を `ADMIN` に更新

### ユーザー一覧が表示されない

- 原因: データベース接続エラー or 権限不足
- 解決: サーバーログを確認、DATABASE_URL の設定を確認

## 環境別の設定

### ローカル開発

```bash
# 開発サーバー起動
npm run dev

# 管理画面アクセス
open http://localhost:3000/admin
```

### Cloud Run (本番)

1. Secret Manager で環境変数を設定済みであることを確認
2. Cloud Run のサービスURLで `/admin` にアクセス

```
https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/admin
```

## 関連ファイル

| ファイル | 説明 |
|---------|------|
| `app/admin/layout.tsx` | 管理画面の共通レイアウト |
| `app/admin/page.tsx` | ダッシュボード概要 |
| `app/admin/users/page.tsx` | ユーザー管理 |
| `app/admin/usage/page.tsx` | 利用状況監視 |
| `middleware.ts` | RBAC保護 |
| `app/api/admin/*` | 管理API |
