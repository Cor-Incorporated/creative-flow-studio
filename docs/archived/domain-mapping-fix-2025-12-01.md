# ドメインマッピング修正作業記録

**日付**: 2025-12-01  
**作業者**: Cursor (インフラ担当)

## 問題

- ドメイン `blunaai.com` が間違って `creative-flow-studio` サービスに紐づけられていた
- 正しくは `creative-flow-studio-dev` サービスに紐づける必要がある
- 不要な `creative-flow-studio` サービスを削除する必要がある

## 実行した作業

### 1. ドメインマッピングの削除

```bash
gcloud beta run domain-mappings delete \
  --domain=blunaai.com \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic
```

**結果**: ✅ 成功

### 2. 正しいサービスへのドメインマッピング作成

```bash
gcloud beta run domain-mappings create \
  --domain=blunaai.com \
  --service=creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic
```

**結果**: ✅ 成功

**DNSレコード情報**:
- **A レコード** (IPv4):
  - 216.239.32.21
  - 216.239.34.21
  - 216.239.36.21
  - 216.239.38.21
- **AAAA レコード** (IPv6):
  - 2001:4860:4802:32::15
  - 2001:4860:4802:34::15
  - 2001:4860:4802:36::15
  - 2001:4860:4802:38::15

### 3. 不要なサービスの削除

```bash
gcloud run services delete creative-flow-studio \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --quiet
```

**結果**: ✅ 成功

## 現在の状態

### ✅ 完了した項目

1. ドメインマッピングが `creative-flow-studio-dev` サービスに正しく設定された
2. 不要な `creative-flow-studio` サービスを削除した
3. 現在のサービス一覧:
   - ✅ `creative-flow-studio-dev` (asia-northeast1) - アクティブ

### ⚠️ 次のステップ（DNS設定）

ドメイン `blunaai.com` のDNSレコードを以下のように設定する必要があります：

**設定が必要なDNSレコード**:

| タイプ  | 名前                | 値                    |
|------|---------------------|-----------------------|
| A    | @ (または blunaai.com) | 216.239.32.21         |
| A    | @ (または blunaai.com) | 216.239.34.21         |
| A    | @ (または blunaai.com) | 216.239.36.21         |
| A    | @ (または blunaai.com) | 216.239.38.21         |
| AAAA | @ (または blunaai.com) | 2001:4860:4802:32::15 |
| AAAA | @ (または blunaai.com) | 2001:4860:4802:34::15 |
| AAAA | @ (または blunaai.com) | 2001:4860:4802:36::15 |
| AAAA | @ (または blunaai.com) | 2001:4860:4802:38::15 |

**注意事項**:
- DNSレコードの設定後、証明書のプロビジョニングが自動的に開始されます
- 証明書の発行には数分〜数時間かかる場合があります
- DNSレコードが正しく設定されると、`blunaai.com` で `creative-flow-studio-dev` サービスにアクセスできるようになります

## 確認コマンド

### ドメインマッピングの状態確認

```bash
gcloud beta run domain-mappings describe \
  --domain=blunaai.com \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic
```

### サービス一覧の確認

```bash
gcloud run services list \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic
```

## 参考

- [Cloud Run ドメインマッピング公式ドキュメント](https://cloud.google.com/run/docs/mapping-custom-domains)
- プロジェクト: `dataanalyticsclinic`
- リージョン: `asia-northeast1`
- サービス名: `creative-flow-studio-dev`



