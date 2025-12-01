# OAuth認証エラーのトラブルシューティング

## 「このアプリのリクエストは無効です」エラー

このエラーはGoogle OAuthの設定に問題がある場合に発生します。

### 原因と修正方法

#### 1. NEXTAUTH_URL がCloud Runに設定されていない

**症状**: Google認証ボタンをクリックすると、リダイレクトURIエラーが発生する

**確認方法**:
```bash
gcloud run services describe creative-flow-studio-dev \
  --region=asia-northeast1 \
  --format="yaml(spec.template.spec.containers[0].env)"
```

**修正方法**:
1. `infra/envs/dev/terraform.tfvars` に以下を設定:
```hcl
cloud_run_env_vars = {
  NEXTAUTH_URL = "https://blunaai.com"
  # ... other env vars
}
```

2. Terraform を再適用:
```bash
cd infra/envs/dev
terraform apply
```

#### 2. trustHost設定がNextAuth.jsにない

**症状**: 複数のドメイン（Cloud Run URLとカスタムドメイン）で認証が動作しない

**確認方法**: `lib/auth.ts` に `trustHost: true` があるか確認

**修正方法**: `lib/auth.ts` の `authOptions` に以下を追加:
```typescript
export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    trustHost: true, // これを追加
    // ...
};
```

#### 3. Google Cloud ConsoleのリダイレクトURIが未登録

**症状**: 特定のドメインでのみ認証が失敗する

**確認方法**:
1. [Google Cloud Console - 認証情報](https://console.cloud.google.com/apis/credentials?project=dataanalyticsclinic) にアクセス
2. OAuth 2.0 クライアント ID を選択
3. 「承認済みのリダイレクト URI」を確認

**必要なリダイレクトURI**:
```
https://blunaai.com/api/auth/callback/google
https://creative-flow-studio-dev-667780715339.asia-northeast1.run.app/api/auth/callback/google
http://localhost:3000/api/auth/callback/google
```

**必要なJavaScript生成元**:
```
https://blunaai.com
https://creative-flow-studio-dev-667780715339.asia-northeast1.run.app
http://localhost:3000
```

### デプロイ後のチェックリスト

1. [ ] Cloud Run環境変数に `NEXTAUTH_URL` が正しく設定されている
2. [ ] `lib/auth.ts` に `trustHost: true` が設定されている
3. [ ] Google Cloud ConsoleでリダイレクトURIが登録されている
4. [ ] Google Cloud ConsoleでJavaScript生成元が登録されている
5. [ ] DNS設定でカスタムドメインがCloud Runにマッピングされている

### 関連ファイル

- `lib/auth.ts` - NextAuth.js設定
- `infra/envs/dev/variables.tf` - Cloud Run環境変数のデフォルト値
- `infra/envs/dev/terraform.tfvars` - 実際の環境変数値
- `cloudbuild.yaml` - CI/CDパイプライン設定
