# Development Tools and Roles

このプロジェクトでは、複数のAI開発ツールが役割分担して開発を進めています。

---

## Claude Code (フルスタック実装)

### 担当領域
- Next.js アプリケーションのフロントエンド・バックエンド実装
- API Routes の開発とテスト
- React コンポーネントの作成
- データベーススキーマの設計と Prisma Client の利用
- Vitest / Playwright テストの作成
- ドキュメント更新

### 特徴
- **外部接続可能**（Web検索、API呼び出し可）
- コード生成・編集に最適化
- MCP (Model Context Protocol) サーバー統合により高度なコード解析が可能
- Serenaツールによるシンボリック検索・編集が可能

### 制約
- ローカル開発環境での作業のみ
- GCP / Terraform は Codex が管理

### 最適な利用シーン
- Phase 4-6 のフロントエンド・API実装
- React コンポーネントの作成・修正
- Vitest テストの作成
- ドキュメント更新（CLAUDE.md, docs/*.md）

### 現在の役割
- ✅ Phase 4完了（Conversation Persistence）
- ✅ Phase 5完了（Stripe Integration）
- ✅ Phase 6 Step 1完了（Admin Dashboard RBAC）
- 🔄 Phase 6 Step 2-3の実装候補

---

## Cursor (バックエンド・クラウド開発)

### 担当領域
- バックエンドAPI の実装
- クラウドインフラ関連のコード
- 複雑なサーバーサイドロジック
- パフォーマンス最適化

### 特徴
- **IDE統合により高速なコード編集**
- コンテキスト保持が優れている
- 大規模なコードベースでの作業が得意
- ファイル間の依存関係を効率的に処理

### 最適な利用シーン
- Phase 6 以降のバックエンド重視の実装
- 既存コードの大幅なリファクタリング
- 複雑なサーバーサイドロジックの実装

### 推奨される利用タイミング
- Phase 6 Step 2-3 のバックエンドAPI実装
- 既存のAPI Routesの大幅な修正
- パフォーマンス最適化（Prisma クエリなど）

---

## Codex (レビュー係・要件定義・インフラ管理)

### 担当領域
- 要件定義の矛盾チェック
- アーキテクチャレビュー
- セキュリティ監査
- コード品質レビュー
- **Terraform / GCP インフラ管理**

### 特徴
- **外部接続不可**（Web検索、API呼び出しできない）
- 深い思考と論理的分析に特化
- 既存のドキュメントとコードから矛盾を検出
- Terraform によるインフラ管理の専門家

### 制約
- 最新の外部情報（公式ドキュメント、ライブラリバージョン）にアクセスできない
- 実装よりもレビュー・検証に専念
- Web検索やAPI呼び出しは不可

### 最適な利用シーン
- 実装完了後のレビュー
- Phase 間の移行時の整合性チェック
- セキュリティ要件の検証
- Terraform でのGCPインフラ管理
- Cloud Build / Cloud Run の設定

### 推奨される利用タイミング
- Phase 5 & 6 実装のセキュリティレビュー
- RBAC実装の妥当性検証
- Prisma クエリのパフォーマンス確認
- GCPインフラの更新（Terraform）

---

## 推奨される開発フロー

### 1. 設計フェーズ
- **担当**: Claude Code または Cursor
- 初期実装の提案、要件の整理
- アーキテクチャの検討

### 2. 実装フェーズ
- **フロントエンド・API**: Claude Code
  - React コンポーネント
  - API Routes (Next.js)
  - Prisma を使ったDB操作
- **バックエンド・インフラ**: Cursor または Codex
  - 複雑なサーバーサイドロジック
  - Terraform (Codexのみ)
  - パフォーマンス最適化

### 3. レビューフェーズ
- **担当**: Codex
- 要件整合性チェック
- セキュリティ監査
- コード品質レビュー

### 4. テストフェーズ
- **担当**: Claude Code
- Vitest テストの作成・実行
- Playwright E2Eテスト
- テストカバレッジの確認

### 5. デプロイフェーズ
- **担当**: Codex
- Terraform でのインフラ管理
- Cloud Build / Cloud Run の設定
- 本番デプロイの監視

---

## ツール間の連携パターン

### パターン1: Claude Code → Codex
1. Claude Code が実装完了（例: Phase 5 Stripe Integration）
2. Codex がセキュリティレビュー
3. Codex が指摘した問題を Claude Code が修正

### パターン2: Claude Code ⇄ Cursor
1. Claude Code がフロントエンド実装
2. Cursor がバックエンドAPI実装
3. Claude Code がテスト作成・実行

### パターン3: Codex → Claude Code/Cursor
1. Codex が要件定義の矛盾を検出
2. Claude Code/Cursor が修正実装
3. Codex が再レビュー

---

## 現在の状況 (2025-11-13)

### Claude Code の担当範囲
- ✅ Phase 4完了（Conversation Persistence）
- ✅ Phase 5完了（Stripe Integration）
- ✅ Phase 6 Step 1完了（Admin Dashboard RBAC）

### 次のステップの推奨担当
- **Phase 6 Step 2**: Admin API Routes
  - Claude Code または Cursor（APIルート実装）
- **Phase 6 Step 3**: Admin Pages
  - Claude Code（フロントエンドUI実装）
- **Manual Testing**: Claude Code（テスト実行とドキュメント参照）
- **Code Review**: Codex（セキュリティとパフォーマンス検証）

---

## 重要な注意事項

### Claude Code
- ✅ 外部ドキュメント（Stripe, Gemini API）へのアクセス可能
- ✅ MCP Serena ツールで効率的なコード検索
- ❌ GCP / Terraform は触らない（Codex の領域）

### Cursor
- ✅ IDE統合で高速編集
- ✅ 大規模なリファクタリング
- ❌ テスト作成は Claude Code が得意

### Codex
- ✅ 深い思考と論理的分析
- ✅ Terraform / GCP インフラ管理
- ❌ 最新の外部情報へのアクセス不可
- ❌ Web検索不可（外部ドキュメント参照不可）

---

## まとめ

- **フロントエンド・API・テスト**: Claude Code
- **バックエンド・最適化**: Cursor
- **レビュー・インフラ**: Codex

この役割分担により、効率的かつ高品質な開発が可能です。
