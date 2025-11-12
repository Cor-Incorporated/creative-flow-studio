# 会話永続化 API 設計

## 概要

ユーザーの会話履歴を Prisma 経由で PostgreSQL に永続化するための API 設計。NextAuth.js のセッション認証と連携し、ユーザーごとに会話とメッセージを管理します。

## データモデル

### Conversation

```prisma
model Conversation {
    id        String         @id @default(cuid())
    title     String?
    userId    String
    mode      GenerationMode @default(CHAT)
    createdAt DateTime       @default(now())
    updatedAt DateTime       @updatedAt

    user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
    messages Message[]
}
```

### Message

```prisma
model Message {
    id             String      @id @default(cuid())
    conversationId String
    role           MessageRole
    content        Json // ContentPart[] structure
    createdAt      DateTime    @default(now())

    conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
}
```

### Content Structure (JSON)

Message の `content` フィールドには、フロントエンドの `ContentPart[]` 構造を JSON として保存:

```typescript
type ContentPart = {
    text?: string;
    media?: Media;
    sources?: GroundingSource[];
    isLoading?: boolean;
    status?: string;
    isError?: boolean;
    isEditing?: boolean;
    originalMedia?: Media;
};
```

## API エンドポイント

### 1. Conversation CRUD

#### GET /api/conversations

ユーザーの会話一覧を取得。

**認証**: 必須 (NextAuth session)

**Query Parameters**:

-   `limit` (optional, default: 20): 取得件数
-   `offset` (optional, default: 0): オフセット
-   `mode` (optional): GenerationMode でフィルタ ('CHAT' | 'PRO' | 'SEARCH' | 'IMAGE' | 'VIDEO')

**Response**:

```json
{
    "conversations": [
        {
            "id": "clxxx",
            "title": "画像生成について",
            "mode": "IMAGE",
            "createdAt": "2025-11-12T10:00:00Z",
            "updatedAt": "2025-11-12T10:30:00Z",
            "messageCount": 5
        }
    ],
    "total": 42
}
```

#### POST /api/conversations

新しい会話を作成。

**認証**: 必須

**Body**:

```json
{
    "title": "新しい会話", // optional
    "mode": "CHAT" // optional, default: CHAT
}
```

**Response**:

```json
{
    "conversation": {
        "id": "clxxx",
        "title": "新しい会話",
        "mode": "CHAT",
        "userId": "user_xxx",
        "createdAt": "2025-11-12T10:00:00Z",
        "updatedAt": "2025-11-12T10:00:00Z"
    }
}
```

#### GET /api/conversations/[id]

特定の会話とそのメッセージを取得。

**認証**: 必須 (自分の会話のみアクセス可能)

**Response**:

```json
{
    "conversation": {
        "id": "clxxx",
        "title": "画像生成について",
        "mode": "IMAGE",
        "userId": "user_xxx",
        "createdAt": "2025-11-12T10:00:00Z",
        "updatedAt": "2025-11-12T10:30:00Z",
        "messages": [
            {
                "id": "msg_xxx",
                "role": "USER",
                "content": [{ "text": "猫の画像を生成して" }],
                "createdAt": "2025-11-12T10:00:00Z"
            },
            {
                "id": "msg_yyy",
                "role": "MODEL",
                "content": [
                    {
                        "media": {
                            "type": "image",
                            "url": "data:image/png;base64,...",
                            "mimeType": "image/png"
                        }
                    }
                ],
                "createdAt": "2025-11-12T10:01:00Z"
            }
        ]
    }
}
```

#### PATCH /api/conversations/[id]

会話のタイトルを更新。

**認証**: 必須 (自分の会話のみ)

**Body**:

```json
{
    "title": "新しいタイトル"
}
```

**Response**:

```json
{
    "conversation": {
        "id": "clxxx",
        "title": "新しいタイトル",
        "mode": "CHAT",
        "updatedAt": "2025-11-12T11:00:00Z"
    }
}
```

#### DELETE /api/conversations/[id]

会話とそのメッセージを削除。

**認証**: 必須 (自分の会話のみ)

**Response**:

```json
{
    "success": true,
    "deletedId": "clxxx"
}
```

### 2. Message API

#### POST /api/conversations/[id]/messages

会話にメッセージを追加。

**認証**: 必須 (自分の会話のみ)

**Body**:

```json
{
    "role": "USER", // 'USER' | 'MODEL' | 'SYSTEM'
    "content": [
        {
            "text": "こんにちは"
        },
        {
            "media": {
                "type": "image",
                "url": "data:image/png;base64,...",
                "mimeType": "image/png"
            }
        }
    ]
}
```

**Response**:

```json
{
    "message": {
        "id": "msg_xxx",
        "conversationId": "clxxx",
        "role": "USER",
        "content": [{ "text": "こんにちは" }],
        "createdAt": "2025-11-12T10:00:00Z"
    }
}
```

#### GET /api/conversations/[id]/messages

会話のメッセージ一覧を取得。

**認証**: 必須 (自分の会話のみ)

**Query Parameters**:

-   `limit` (optional, default: 50)
-   `offset` (optional, default: 0)

**Response**:

```json
{
    "messages": [
        {
            "id": "msg_xxx",
            "role": "USER",
            "content": [{ "text": "こんにちは" }],
            "createdAt": "2025-11-12T10:00:00Z"
        }
    ],
    "total": 10
}
```

## 実装順序

### Phase 1: 基本 CRUD (最小限の機能)

1. **POST /api/conversations** - 会話作成
2. **POST /api/conversations/[id]/messages** - メッセージ追加
3. **GET /api/conversations/[id]** - 会話とメッセージ取得

### Phase 2: 一覧と管理

4. **GET /api/conversations** - 会話一覧
5. **PATCH /api/conversations/[id]** - タイトル更新
6. **DELETE /api/conversations/[id]** - 会話削除

### Phase 3: フロントエンド統合

7. app/page.tsx で会話の自動保存を実装
8. 会話履歴 UI の追加（サイドバー等）
9. 会話の読み込み・切り替え機能

## セキュリティ要件

-   **認証**: すべてのエンドポイントで NextAuth session チェック必須
-   **認可**: ユーザーは自分の会話のみアクセス可能（userId チェック）
-   **入力検証**: Zod スキーマで Request body を検証
-   **Rate Limiting**: API Routes に Rate Limit 適用（将来実装）

## Validation Schemas

```typescript
// lib/validators.ts
import { z } from 'zod';

export const createConversationSchema = z.object({
    title: z.string().max(200).optional(),
    mode: z.enum(['CHAT', 'PRO', 'SEARCH', 'IMAGE', 'VIDEO']).optional(),
});

export const updateConversationSchema = z.object({
    title: z.string().max(200),
});

export const createMessageSchema = z.object({
    role: z.enum(['USER', 'MODEL', 'SYSTEM']),
    content: z.array(
        z.object({
            text: z.string().optional(),
            media: z
                .object({
                    type: z.enum(['image', 'video']),
                    url: z.string(),
                    mimeType: z.string(),
                })
                .optional(),
            sources: z
                .array(
                    z.object({
                        uri: z.string(),
                        title: z.string().optional(),
                    })
                )
                .optional(),
        })
    ),
});
```

## 次のステップ

1. ✅ API 設計の文書化（このドキュメント）
2. ⏳ Validation schemas の実装 (`lib/validators.ts`)
3. ⏳ Phase 1 API Routes の実装
4. ⏳ フロントエンドとの統合（app/page.tsx）
5. ⏳ 会話履歴 UI の追加
