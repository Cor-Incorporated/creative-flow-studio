# Cloud Build マイグレーション設定ガイド

**最終更新:** 2025-12-01  
**対象環境:** Cloud Build (CI/CD)  
**目的:** Cloud BuildパイプラインでPrismaマイグレーションを自動実行するための設定

---

## 概要

Cloud Buildパイプラインでデータベースマイグレーションを自動実行するため、Cloud SQL Proxyを使用してCloud SQLインスタンスに接続します。

**重要なポイント:**
- Cloud BuildからCloud SQLに接続するには、Cloud SQL Proxyを使用します
- パブリックIPは不要です（VPCコネクタ経由でプライベートIPに接続可能）
- Cloud Buildのサービスアカウントに`roles/cloudsql.client`権限が必要です

---

## 設定内容

### 1. cloudbuild.yaml の更新

`cloudbuild.yaml`にマイグレーションステップを追加しました：

```yaml
- id: 'Apply database migrations'
  name: 'gcr.io/cloud-builders/docker'
  entrypoint: 'bash'
  args:
      - '-c'
      - |
          # Cloud SQL Proxyをダウンロード・起動
          wget -q https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O cloud_sql_proxy
          chmod +x cloud_sql_proxy
          ./cloud_sql_proxy -instances=${_CLOUD_SQL_INSTANCE}=tcp:5432 &
          sleep 5
          
          # DATABASE_URLをlocalhost経由に変換
          DB_URL_LOCAL=$(echo "$$DATABASE_URL" | sed 's|host=/cloudsql/[^?]*|host=127.0.0.1|')
          export DATABASE_URL="$$DB_URL_LOCAL"
          
          # Prismaマイグレーションを実行
          npx prisma migrate deploy
  secretEnv:
      - DATABASE_URL
  waitFor: ['Generate Prisma client']
```

### 2. Secret Manager の設定

`DATABASE_URL`をSecret Managerから取得するように設定：

```yaml
availableSecrets:
    secretManager:
        - versionName: projects/${_PROJECT_ID}/secrets/database-url/versions/latest
          env: DATABASE_URL
```

**注意:** `DATABASE_URL`はマイグレーションステップでのみ使用され、Next.jsのビルド時には使用されません（ビルド時のハードコーディングを防ぐため）。

---

## 必要な権限

Cloud Buildのサービスアカウント（`cloud-build-runner@dataanalyticsclinic.iam.gserviceaccount.com`）に以下の権限が必要です：

- `roles/cloudsql.client` - Cloud SQLインスタンスへの接続
- `roles/secretmanager.secretAccessor` - Secret Managerからのシークレット取得

---

## 動作フロー

1. **依存関係のインストール** (`npm ci`)
2. **Prisma Clientの生成** (`npx prisma generate`)
3. **マイグレーションの適用** (`npx prisma migrate deploy`)
   - Cloud SQL Proxyを起動
   - DATABASE_URLをlocalhost経由に変換
   - マイグレーションを実行
   - Proxyを停止
4. **Next.jsアプリのビルド** (`npm run build`)
5. **Dockerイメージのビルド・プッシュ**
6. **Cloud Runへのデプロイ**

---

## トラブルシューティング

### 問題1: Cloud SQL Proxyの起動に失敗する

**原因:** Cloud Buildのサービスアカウントに`roles/cloudsql.client`権限が付与されていない

**解決策:**
```bash
gcloud projects add-iam-policy-binding dataanalyticsclinic \
  --member="serviceAccount:cloud-build-runner@dataanalyticsclinic.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

### 問題2: DATABASE_URLが取得できない

**原因:** Secret Managerへのアクセス権限がない

**解決策:**
```bash
gcloud secrets add-iam-policy-binding database-url \
  --member="serviceAccount:cloud-build-runner@dataanalyticsclinic.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=dataanalyticsclinic
```

### 問題3: マイグレーションがタイムアウトする

**原因:** Cloud SQL Proxyの起動に時間がかかっている

**解決策:** `sleep 5`の時間を延長するか、Proxyの起動確認を改善する

---

## ローカル開発環境でのマイグレーション

ローカル開発環境からマイグレーションを実行する場合：

### 方法1: Cloud SQL Proxyを使用（推奨）

```bash
# Cloud SQL Proxyを起動
cloud-sql-proxy dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql --port=5433

# 別のターミナルで
export DATABASE_URL="postgresql://app_user:PASSWORD@127.0.0.1:5433/creative_flow_studio"
npm run prisma:migrate deploy
```

### 方法2: スクリプトを使用

```bash
./scripts/apply-migration.sh
```

**注意:** ローカル環境から接続する場合、Cloud SQLインスタンスにパブリックIPが必要な場合があります。Terraformで`ipv4_enabled = true`に設定してください。

---

## Terraform設定

Cloud SQLインスタンスのパブリックIPをオプション化しました：

```hcl
module "cloud_sql" {
  source = "../../modules/cloud_sql"
  
  # ... 他の設定 ...
  
  ipv4_enabled = false  # デフォルトはfalse（プライベートIPのみ）
}
```

**ローカル開発用にパブリックIPを有効化する場合:**
```hcl
ipv4_enabled = true  # 一時的に有効化（マイグレーション後は無効化推奨）
```

---

## セキュリティ考慮事項

1. **パブリックIPの使用:**
   - 本番環境では`ipv4_enabled = false`を推奨
   - ローカル開発やマイグレーション時のみ一時的に有効化
   - 使用後は必ず無効化

2. **Secret Manager:**
   - `DATABASE_URL`はSecret Managerで管理
   - Cloud Buildのサービスアカウントに最小限の権限を付与

3. **Cloud SQL Proxy:**
   - 認証情報は自動的に管理される
   - 接続は暗号化される

---

## 参考資料

- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Cloud SQL Proxy Documentation](https://cloud.google.com/sql/docs/postgres/sql-proxy)
- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Cloud Build - Connect to Cloud SQL](https://cloud.google.com/build/docs/deploying-builds/deploy-cloud-run#connect_sql)

---

**最終更新**: 2025-12-01  
**担当**: Claude Code
