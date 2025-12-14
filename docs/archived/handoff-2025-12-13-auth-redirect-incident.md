# 2025-12-13 引き継ぎメモ: blunaai.com 308リダイレクトループ / OAuth障害

## 概要
2025-12-13 に `https://blunaai.com/` が **308を返し続けて画面が開けない**（=ブラウザが固まる）障害が発生。
根本原因は Cloud Run のカスタムドメイン/プロキシ環境での `Host` / `X-Forwarded-Host` 差異を考慮せず、middleware の canonical redirect が **自己リダイレクト**を発生させたこと。

併発して、Google OAuth の `OAuthCallbackError: State cookie was missing` も発生していた（OAuth開始ホストと callback ホストが不一致）。

## 影響
- `blunaai.com` のトップページ（`/`）が表示できない（308ループ）
- OAuth開始/コールバックのホスト不一致によりログイン失敗が発生し得る

## 原因（要点）
### 1) OAuthCallback（State cookie missing）
- OAuth開始: `*.run.app` 側で `/api/auth/signin/google`
- callback: `blunaai.com` 側で `/api/auth/callback/google`
- state cookie が別オリジンに保存され、callback時に見つからず失敗

### 2) 308リダイレクトループ（blunaai.comが固まる）
- Cloud Run のドメインマッピング/プロキシ下では、状況により
  - `Host` が内部の `*.run.app` を指すことがある
  - 元のドメインは `X-Forwarded-Host` に保持されることがある
- canonical redirect 判定が `request.nextUrl.hostname`（=Host由来）だけだと、
  毎回「別ホスト」と誤判定 → **Locationが同一URLの308** → 無限ループ

## 実施した修正（PR）
（番号は GitHub PR）
- **#21**: `blunaai.com` の 308 ループ停止  
  - canonical host 判定を `X-Forwarded-Host` 優先に変更
- **#24**: #21 の回帰防止  
  - host判定ロジックを `lib/canonicalHost.ts` に切り出し
  - 単体テスト追加（`x-forwarded-host` / カンマ区切り / port / ヘッダ欠損）
  - 本事象のドキュメント追記（`docs/OAUTH_TROUBLESHOOTING.md`）
- **#19**: OAuth state cookie mismatch 予防（canonical host redirect導入）
- **#20**: canonical redirect で `:8080` が外部へ漏れないよう修正
- **#18**: `OAuthAccountNotLinked` 対応（既存メールの安全なリンク）

## 現在の期待状態（正常系）
- `curl -I https://blunaai.com/` が **200**
- `curl -L https://blunaai.com/` で **redirects=0**（または正規化のための1回程度で収束）
- `Cloud Run` の最新リビジョンが `develop` 由来で動作している

## 検証手順（コマンド）
### 1) 308ループの有無
```bash
curl -sS -I https://blunaai.com/ | sed -n '1,30p'
curl -sS -L -o /dev/null -w 'final_url=%{url_effective}\nhttp_code=%{http_code}\nredirects=%{num_redirects}\n' https://blunaai.com/ --max-time 20
```

### 2) Cloud Run の最新リビジョン確認
```bash
PROJECT=dataanalyticsclinic
REGION=asia-northeast1
SERVICE=creative-flow-studio-dev

gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" \
  --format='table(status.url,status.latestReadyRevision,status.latestCreatedRevision,metadata.generation)'

gcloud run revisions list --project "$PROJECT" --region "$REGION" --service "$SERVICE" --limit=10 \
  --format='table(metadata.name,metadata.creationTimestamp,status.conditions[0].status)'
```

### 3) 308が出ている場合のログ確認
```bash
PROJECT=dataanalyticsclinic
SERVICE=creative-flow-studio-dev
SINCE=$(date -u -v-60M +%Y-%m-%dT%H:%M:%SZ)

gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE AND timestamp>=\"$SINCE\" AND httpRequest.status=308" \
  --project=$PROJECT --limit=100 \
  --format='table(timestamp,resource.labels.revision_name,httpRequest.requestUrl,httpRequest.referer,httpRequest.userAgent)'
```

### 4) OAuthCallback（State cookie missing）のログ確認
```bash
PROJECT=dataanalyticsclinic
SERVICE=creative-flow-studio-dev
SINCE=$(date -u -v-60M +%Y-%m-%dT%H:%M:%SZ)

gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE AND timestamp>=\"$SINCE\" AND textPayload:\"State cookie was missing\"" \
  --project=$PROJECT --limit=50 \
  --format='table(timestamp,resource.labels.revision_name,textPayload)'
```

## セキュリティ前提（重要）
- `X-Forwarded-Host` を信頼するのは **Cloud Run など信頼できるプロキシ配下で動く**ことが前提。
- 直にインターネットへ露出する構成へ移す場合は、`X-Forwarded-Host` の **許可ホスト制限（allowlist）** を検討すること。

## ブランチ整理（実施済み）
- マージ済みの feature ブランチは **リモートから削除済み**
- ローカルも `origin/*: gone` のブランチを削除済み

## 今後やるべきアクション
- **（監視）**: `httpRequest.status=308` の急増監視（ログベース）を入れると再発検知が早い
- **（E2E）**: Playwright で「トップ表示 → サインイン開始 → callback成功」までの最小E2Eを追加（Cookie/Host系の回帰に強い）



