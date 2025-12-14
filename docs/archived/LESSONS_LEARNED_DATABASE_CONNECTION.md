# データベース接続トラブルシューティング - 教訓と解決策

**日付**: 2025-12-01  
**問題期間**: 06:26 - 12:23 JST（約6時間）  
**影響**: Google OAuth認証とメール/パスワード認証が失敗

---

## 🔍 問題の全体像

### 発生した問題

1. **Google OAuth認証エラー** - `error=OAuthCallback`
2. **メール/パスワード認証失敗** - データベース接続エラー
3. **Prisma接続エラー** - 複数の異なるエラーメッセージ

### 根本原因

**DATABASE_URLの設定が複数の問題を抱えていた:**

1. ❌ 間違ったシークレット参照（`secret-alias-1` vs `database-url`）
2. ❌ 間違ったパスワード
3. ❌ URLフォーマットエラー（`@/` vs `@localhost`）
4. ❌ URLエンコーディング不足（`:` vs `%3A`）
5. ❌ VPC egress設定ミス（`all-traffic` vs `private-ranges-only`）
6. ❌ ビルド時にDATABASE_URLが設定されていない

---

## 📋 失敗の履歴

### リビジョン00035-00052: 失敗の連鎖

| リビジョン | DATABASE_URLフォーマット | VPC Egress | 結果 | エラー |
|-----------|------------------------|------------|------|--------|
| 00035-6wz | `@/` (パスワード不明) | all-traffic | ❌ | empty host |
| 00036-kjr | `secret-alias-1` (古い) | all-traffic | ❌ | empty host |
| 00037-dgx | `@localhost` (間違ったPW) | all-traffic | ❌ | Can't reach |
| 00038-cvh | `@/` (間違ったPW) | all-traffic | ❌ | empty host |
| 00039-8ts | `@localhost` (正しいPW) | all-traffic | ❌ | Can't reach |
| 00040-l4w | `@localhost` (正しいPW) | all-traffic | ❌ | Can't reach |
| 00041-mtp | `@/` (正しいPW) | private-ranges-only | ❌ | empty host |
| 00042-00050 | 様々な組み合わせ | 様々 | ❌ | 様々なエラー |
| 00051-9qq | `@localhost` (エンコードあり、間違ったPW) | private-ranges-only | ❌ | password auth failed |
| **00052-pls** | `@localhost` (エンコードあり、間違ったPW) | **private-ranges-only** | ❌ | password auth failed |
| **00053-8ss** | **`@localhost` (エンコードあり、正しいPW)** | **private-ranges-only** | ✅ | **成功** |

---

## ✅ 最終的な解決策

### 必要な設定（すべて揃って初めて動作）

1. **DATABASE_URLフォーマット:**
   ```
   postgresql://app_user:hji6J8PGfVlkeymrhZ0dTbaZ@localhost/creative_flow_studio?host=/cloudsql/dataanalyticsclinic%3Aasia-northeast1%3Acreative-flow-studio-sql
   ```

2. **VPC egress:**
   ```
   private-ranges-only
   ```

3. **Cloud SQL接続アノテーション:**
   ```
   run.googleapis.com/cloudsql-instances: dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql
   ```

4. **ビルド時のDATABASE_URL:**
   ```yaml
   env:
     - 'DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy'
   ```

5. **Dockerfileの設定:**
   ```dockerfile
   ARG DATABASE_URL
   ENV DATABASE_URL=${DATABASE_URL:-}
   ```

---

## 🎓 教訓

### 1. URLエンコーディングの重要性

Prismaの接続文字列パーサーは、コロン（`:`）をポート区切り文字として解釈します。Cloud SQL接続名に含まれるコロンをエスケープするには、`%3A`にエンコードする必要があります。

### 2. `@localhost`の必要性

`@/`形式は一部のPostgreSQLクライアントで動作しますが、Prismaは「empty host」として拒否します。`@localhost`をプレースホルダーとして使用し、実際の接続先は`host=`パラメータで指定します。

### 3. VPC egressの重要性

`all-traffic`では、Cloud RunがVPC Connectorを経由せず、直接外部（パブリックIP）へ接続しようとします。Cloud SQL Unix socketはVPC内にあるため、`private-ranges-only`を使用する必要があります。

### 4. ビルド時とランタイムの分離

Next.jsのビルドプロセスでPrisma Clientが初期化されるため、ビルド時にもDATABASE_URLが必要です。ただし、実際のデータベースに接続する必要はないため、ダミー値を使用します。

### 5. パスワードの管理

複数のSecret Managerバージョンが存在すると、どれが正しいパスワードか分からなくなります。Terraformのoutputやドキュメントで正しいパスワードを明確に記録する必要があります。

---

## 🔄 今後の対応

### ドキュメント整備

- [x] DATABASE_URL設定ガイドを作成
- [x] トラブルシューティングガイドを作成
- [x] 失敗の履歴を記録

### クリーンアップ

- [ ] 失敗したCloud Runリビジョン（00035-00052）を削除
- [ ] 不要なSecret Managerバージョン（7-12）を削除
- [ ] Terraformのドキュメントを更新

### 予防策

- [ ] CI/CDパイプラインにDATABASE_URL検証ステップを追加
- [ ] Terraformで正しいDATABASE_URLを自動生成
- [ ] デプロイ後の自動テストスクリプトを作成

---

## 📞 サポート

問題が再発した場合は、以下のドキュメントを参照してください：

1. [DATABASE_URL設定ガイド](./DATABASE_URL_SETUP_GUIDE.md)
2. [Cloud SQL接続ガイド](./cloud-sql-connection-guide.md)
3. [インターフェース仕様書](./interface-spec.md)

---

**重要:** このドキュメントに記載された設定以外は使用しないでください。過去の試行錯誤の結果、この組み合わせのみが動作することが確認されています。


