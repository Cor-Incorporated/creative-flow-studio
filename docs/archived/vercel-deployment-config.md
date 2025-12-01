# Vercel自動デプロイ設定ガイド

**最終更新**: 2025-11-30  
**目的**: mainブランチのみでVercelに自動デプロイするように設定

---

## 📋 現在の状況

- **mainブランチ**: α版（React + Vite）がVercelでデプロイされている
- **developブランチ**: Next.js版（Google Cloudでデプロイ予定）
- **問題**: すべてのブランチでVercelに自動デプロイされている可能性

---

## 🔧 Vercelダッシュボードでの設定手順

### 1. Vercelダッシュボードにアクセス

1. [Vercel Dashboard](https://vercel.com/dashboard) にログイン
2. `creative-flow-studio` プロジェクトを選択

### 2. プロジェクト設定を開く

1. **Settings** タブをクリック
2. **Git** セクションを開く

### 3. 自動デプロイ設定を変更

**Production Branch** の設定:
- **Production Branch**: `main` に設定
- **Automatic deployments from Git**: 有効

**Ignored Build Step** の設定:
以下の設定を追加して、developブランチでのデプロイを無効化:

```bash
# ブランチ名をチェック
if [ "$VERCEL_GIT_COMMIT_REF" != "main" ]; then
  echo "⏭️  Skipping deployment for branch: $VERCEL_GIT_COMMIT_REF"
  exit 0
fi

# mainブランチの場合のみデプロイ
echo "✅ Deploying main branch"
exit 1
```

または、より簡潔に:

```bash
[ "$VERCEL_GIT_COMMIT_REF" = "main" ] && exit 1 || exit 0
```

**注意**: VercelのIgnored Build Stepでは、`exit 1`でビルドを実行、`exit 0`でスキップします。

---

## 🔍 確認方法

### 設定確認

1. Vercelダッシュボードで **Deployments** タブを開く
2. 新しいブランチ（developなど）にpushした場合、デプロイが作成されないことを確認
3. mainブランチにpushした場合のみ、デプロイが作成されることを確認

### テスト手順

1. **developブランチでテスト**:
   ```bash
   git checkout develop
   # 小さな変更を加える（例: README.mdの更新）
   git commit -m "test: Skip Vercel deployment"
   git push origin develop
   ```
   - Vercelダッシュボードで新しいデプロイが作成されないことを確認

2. **mainブランチでテスト**:
   ```bash
   git checkout main
   # 小さな変更を加える
   git commit -m "test: Deploy to Vercel"
   git push origin main
   ```
   - Vercelダッシュボードで新しいデプロイが作成されることを確認

---

## ⚠️ 重要な注意事項

### mainブランチを保護する

- **決してmainブランチを壊さないように注意**
- developブランチで十分にテストしてからmainにマージ
- mainブランチへの直接pushは避ける（Pull Request経由を推奨）

### ブランチ戦略

- **main**: α版（Vercelでデプロイ）
- **develop**: Next.js版（Google Cloudでデプロイ）
- **feature/***: 機能開発ブランチ（デプロイなし）

---

## 🔗 関連ドキュメント

- [Vercel Documentation - Ignored Build Step](https://vercel.com/docs/concepts/projects/overview#ignored-build-step)
- [Vercel Documentation - Git Integration](https://vercel.com/docs/concepts/git)

---

**作成日**: 2025-11-30  
**担当**: Claude Code
