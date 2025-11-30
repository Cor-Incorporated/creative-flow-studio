# GitHub Secret Scanning の許可手順

## 現在の状況

GitHubのSecret Scanningが以下のコミットでStripeキーを検出しています：

- **コミット**: `6cd2e0e` - "refactor: StripeキーをSecret Managerで管理する形に変更"
- **ファイル**: `docs/stripe-terraform-setup.md`
- **検出されたキー**: Stripeテストキー（テスト環境用）

## 許可手順

以下のURLにアクセスして、この機密情報を許可してください：

**https://github.com/Cor-Incorporated/creative-flow-studio/security/secret-scanning/unblock-secret/36DMTMiNR0WMq4mGz6wvC2hflzN**

1. 上記のURLにアクセス
2. 「Allow secret」をクリック
3. 理由を入力（例: "テスト環境用のStripeキー。既にドキュメントから削除済み"）
4. 許可を確認

## 注意事項

- このキーは**テスト環境用**のStripeキーです
- 既にドキュメントから削除済みです（プレースホルダーに置き換え）
- 本番環境では使用しません

## 許可後の手順

許可後、以下のコマンドでpushを再試行してください：

```bash
git push origin epic-engelbart-fix
```
