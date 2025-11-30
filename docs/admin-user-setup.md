# 管理者ユーザー設定ガイド

## company@cor-jp.comを管理者に変更

### 方法1: SQLスクリプトを実行（推奨）

```bash
# ローカル環境の場合
psql $DATABASE_URL -f prisma/admin-setup.sql

# または、Cloud SQLに接続している場合
psql "postgresql://user:password@host:5432/database" -f prisma/admin-setup.sql
```

### 方法2: Prisma Studioで手動変更

1. `npm run prisma:studio` を実行
2. Usersテーブルを開く
3. `company@cor-jp.com` のユーザーを検索
4. `role` フィールドを `ADMIN` に変更
5. 保存

### 方法3: 直接SQLを実行

```sql
UPDATE "users"
SET role = 'ADMIN', "updatedAt" = NOW()
WHERE email = 'company@cor-jp.com';
```

## 管理者権限の機能

管理者（ADMIN role）は以下の特権を持ちます：

- ✅ **全機能への無制限アクセス**
  - チャット、Proモード、検索モード
  - 画像生成（Imagen 4.0）
  - 動画生成（Veo 3.1）
- ✅ **使用量制限のバイパス**
  - 月間リクエスト数制限なし
  - ファイルサイズ制限なし
  - 動画生成数制限なし
- ✅ **管理画面へのアクセス**
  - `/admin` ページへのアクセス
  - ユーザー管理
  - 使用量モニタリング
  - システム統計

## 実装詳細

管理者権限のバイパスは `lib/subscription.ts` の `checkSubscriptionLimits()` 関数で実装されています：

```typescript
// Check if user is ADMIN - admins bypass all limits
const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
});

if (user?.role === 'ADMIN') {
    // Admin users have unlimited access to all features
    return {
        allowed: true,
        plan: adminPlan || ({} as Plan),
        usageCount: 0,
        limit: null, // Unlimited for admins
    };
}
```

## 確認方法

管理者権限が正しく設定されているか確認：

```sql
SELECT id, email, name, role, "createdAt", "updatedAt"
FROM "users"
WHERE email = 'company@cor-jp.com';
```

期待される結果：
- `role` が `ADMIN` であること

## 注意事項

- 管理者権限は強力な権限です。適切なユーザーにのみ付与してください
- 本番環境では、管理者権限の変更は慎重に行ってください
- 管理者権限を持つユーザーは、すべての機能を無制限で使用できます
