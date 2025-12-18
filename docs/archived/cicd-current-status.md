# CI/CD 現在の状態

**最終更新**: 2025-12-01  
**ステータス**: ✅ 完全自動化済み

---

## 現在のCI/CD設定

### ✅ 自動デプロイ（完全自動化）

**Cloud Buildトリガー**:
- **トリガー名**: `creative-flow-dev-trigger`
- **対象ブランチ**: `develop`
- **ビルド設定**: `cloudbuild.yaml`
- **動作**: `develop`ブランチへのpushで**自動的に**以下が実行されます：

1. **依存関係のインストール** (`npm ci`)
2. **Prisma Clientの生成** (`npx prisma generate`)
3. **データベースマイグレーション** (`npx prisma migrate deploy`) ✅ **自動実行**
4. **Next.jsアプリのビルド** (`npm run build`)
5. **Dockerイメージのビルド・プッシュ**
6. **Cloud Runへのデプロイ**

### ✅ 認証・権限（自動化済み）

- **ローカルでの認証不要**: Cloud Buildが自動的にSecret Managerから認証情報を取得
- **サービスアカウント**: `cloud-build-runner@dataanalyticsclinic.iam.gserviceaccount.com`
- **必要な権限**: 自動的に付与済み
  - `roles/cloudsql.client` - Cloud SQL接続
  - `roles/secretmanager.secretAccessor` - Secret Managerアクセス
  - `roles/run.admin` - Cloud Runデプロイ
  - `roles/storage.admin` - Artifact Registry

### ✅ データベースマイグレーション（自動実行）

**重要**: マイグレーションは**自動的に実行**されます。手動でactionを実行する必要はありません。

`cloudbuild.yaml`の「Apply database migrations」ステップで：
- Cloud SQL Proxyを自動起動
- `npx prisma migrate deploy`を自動実行
- エラーハンドリングとリトライ機能付き

**マイグレーションの動作**:
- `develop`ブランチにpushすると、**自動的に**マイグレーションが実行されます
- マイグレーションファイル（`prisma/migrations/`）が変更されている場合のみ実行
- エラー時は自動リトライ（最大10回）

---

## 使用方法

### 通常の開発フロー

1. **コードを変更**
2. **developブランチにpush**:
   ```bash
   git checkout develop
   git add .
   git commit -m "feat: 新機能を追加"
   git push origin develop
   ```
3. **自動的に以下が実行される**:
   - ✅ マイグレーション（変更がある場合）
   - ✅ ビルド
   - ✅ デプロイ

**ローカルでの認証や手動操作は一切不要です。**

### マイグレーションのみを実行したい場合

通常は不要ですが、マイグレーションのみを手動で実行したい場合：

```bash
# Cloud Buildトリガーを手動実行
gcloud builds triggers run creative-flow-dev-trigger \
  --branch=develop \
  --project=dataanalyticsclinic \
  --region=global
```

ただし、**通常は不要**です。`develop`ブランチにpushすれば自動的に実行されます。

---

## 確認方法

### Cloud Buildの実行状況を確認

```bash
# 最新のビルドを確認
gcloud builds list \
  --project=dataanalyticsclinic \
  --region=global \
  --limit=5 \
  --format="table(id,status,createTime,source.repoSource.branchName)"
```

### トリガーの確認

```bash
gcloud builds triggers describe creative-flow-dev-trigger \
  --project=dataanalyticsclinic \
  --region=global
```

---

## 注意事項

### マイグレーションについて

- **自動実行**: `develop`ブランチにpushすると自動的にマイグレーションが実行されます
- **手動実行は不要**: 通常、手動でactionを実行する必要はありません
- **エラーハンドリング**: マイグレーションエラー時は自動リトライ機能があります

### セキュリティ

- **Secret Manager**: すべての機密情報はSecret Managerで管理
- **サービスアカウント**: 最小権限の原則に基づいて権限を付与
- **認証**: Cloud Buildが自動的に認証情報を取得

---

## まとめ

✅ **developブランチにpushするだけで、以下が自動実行されます**:
1. データベースマイグレーション（変更がある場合）
2. Next.jsアプリのビルド
3. Dockerイメージのビルド・プッシュ
4. Cloud Runへのデプロイ

✅ **ローカルでの認証や手動操作は一切不要です。**

✅ **マイグレーションも自動実行されるため、手動でactionを実行する必要はありません。**

---

**最終更新**: 2025-12-01  
**担当**: Claude Code




