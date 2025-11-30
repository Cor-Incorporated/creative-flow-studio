# Refactoring Design: useConversations Custom Hook

## 概要

現在 `app/page.tsx` 内に直接実装されている会話管理ロジックを、再利用可能なCustom Hook `useConversations` に抽出する設計案。

**実装根拠:**
- [React Custom Hooks Best Practices (2025)](https://medium.com/@deval93/10-react-hooks-explained-with-real-examples-2025-edition-the-guide-i-wish-i-had-3-years-ago-e0b086f761a4)
- [Creating Custom Hooks in React](https://reactjs.org/docs/hooks-custom.html)
- [Advanced React Hooks Patterns](https://www.angularminds.com/blog/advanced-react-hooks-patterns-and-best-practices)

**目的:**
1. ✅ **再利用性** - 他のコンポーネントでも会話機能を使用可能に
2. ✅ **可読性** - `app/page.tsx` のロジック簡素化
3. ✅ **テスタビリティ** - Hook単体でのテスト容易化
4. ✅ **保守性** - 会話関連ロジックの一元管理

**注意:** このドキュメントは設計メモであり、実装は後続フェーズで行う。

---

## Current Implementation Analysis

### 現在の app/page.tsx の責務

**State管理 (8個):**
```typescript
const [messages, setMessages] = useState<Message[]>([...]);
const [isLoading, setIsLoading] = useState<boolean>(false);
const [mode, setMode] = useState<GenerationMode>('chat');
const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
const [isDjShachoMode, setIsDjShachoMode] = useState<boolean>(false);
const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
const [conversations, setConversations] = useState<Conversation[]>([]);
const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
```

**会話関連関数 (6個):**
```typescript
createOrGetConversation()  // 会話作成/取得
saveMessage()              // メッセージ保存
loadConversation()         // 会話読み込み
startNewConversation()     // 新規会話開始
deleteConversation()       // 会話削除
useEffect(() => loadConversations())  // 初期ロード
```

**UI関連関数 (3個):**
```typescript
handleSendMessage()        // メッセージ送信
handleEditImage()          // 画像編集
pollVideoStatus()          // ビデオポーリング
```

**課題:**
- 会話管理とUI制御が密結合
- app/page.tsx が800行超と肥大化
- テストが困難（UI と Logic が分離されていない）

---

## Proposed Hook Structure

### useConversations Hook

**File:** `hooks/useConversations.ts`

**Responsibilities:**
1. 会話一覧の取得・管理
2. 現在の会話ID管理
3. 会話のCRUD操作
4. メッセージの保存

**Interface:**
```typescript
export interface UseConversationsReturn {
    // State
    conversations: Conversation[];
    currentConversationId: string | null;
    isLoading: boolean;

    // Computed
    currentConversation: Conversation | null;

    // Actions
    loadConversations: () => Promise<void>;
    createConversation: (mode: GenerationMode) => Promise<string>;
    loadConversation: (id: string) => Promise<Message[]>;
    updateConversationTitle: (id: string, title: string) => Promise<void>;
    deleteConversation: (id: string) => Promise<void>;
    saveMessage: (role: MessageRole, parts: ContentPart[]) => Promise<void>;
    startNewConversation: () => void;
}

export function useConversations(): UseConversationsReturn {
    // Implementation
}
```

---

## Detailed Design

### 1. Type Definitions

**File:** `hooks/types.ts`

```typescript
export interface Conversation {
    id: string;
    title: string | null;
    mode: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
}

export interface ConversationWithMessages extends Conversation {
    messages: Message[];
}
```

---

### 2. useConversations Implementation

**File:** `hooks/useConversations.ts`

```typescript
import { useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import type { Message, ContentPart, GenerationMode } from '@/types/app';
import type { Conversation } from './types';

export function useConversations() {
    const { data: session } = useSession();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Computed value
    const currentConversation = conversations.find(c => c.id === currentConversationId) || null;

    /**
     * Load user's conversations from API
     */
    const loadConversations = useCallback(async () => {
        if (!session?.user) return;

        try {
            const response = await fetch('/api/conversations?limit=50');
            if (response.ok) {
                const data = await response.json();
                setConversations(data.conversations || []);
            }
        } catch (error) {
            console.error('Error loading conversations:', error);
        }
    }, [session]);

    /**
     * Create a new conversation or return existing one
     */
    const createConversation = useCallback(
        async (mode: GenerationMode): Promise<string> => {
            if (!session?.user) {
                throw new Error('User not authenticated');
            }

            // Return existing conversation if already created
            if (currentConversationId) {
                return currentConversationId;
            }

            try {
                const response = await fetch('/api/conversations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: mode.toUpperCase() }),
                });

                if (!response.ok) {
                    throw new Error('Failed to create conversation');
                }

                const data = await response.json();
                const conversationId = data.conversation.id;

                setCurrentConversationId(conversationId);

                // Refresh conversation list
                await loadConversations();

                return conversationId;
            } catch (error) {
                console.error('Error creating conversation:', error);
                throw error;
            }
        },
        [session, currentConversationId, loadConversations]
    );

    /**
     * Load a specific conversation with its messages
     */
    const loadConversation = useCallback(
        async (conversationId: string): Promise<Message[]> => {
            if (!session?.user) {
                throw new Error('User not authenticated');
            }

            setIsLoading(true);

            try {
                const response = await fetch(`/api/conversations/${conversationId}`);
                if (!response.ok) {
                    throw new Error('Failed to load conversation');
                }

                const data = await response.json();
                const conversation = data.conversation;

                // Set current conversation ID
                setCurrentConversationId(conversation.id);

                // Convert database messages to UI messages
                const loadedMessages: Message[] = conversation.messages.map((msg: any) => ({
                    id: msg.id,
                    role: msg.role.toLowerCase(),
                    parts: msg.content,
                }));

                return loadedMessages;
            } catch (error) {
                console.error('Error loading conversation:', error);
                throw error;
            } finally {
                setIsLoading(false);
            }
        },
        [session]
    );

    /**
     * Update conversation title
     */
    const updateConversationTitle = useCallback(
        async (conversationId: string, title: string) => {
            if (!session?.user) return;

            try {
                const response = await fetch(`/api/conversations/${conversationId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title }),
                });

                if (response.ok) {
                    // Update local state
                    setConversations(prev =>
                        prev.map(c => (c.id === conversationId ? { ...c, title } : c))
                    );
                }
            } catch (error) {
                console.error('Error updating conversation title:', error);
            }
        },
        [session]
    );

    /**
     * Delete a conversation
     */
    const deleteConversation = useCallback(
        async (conversationId: string) => {
            if (!session?.user) return;

            try {
                const response = await fetch(`/api/conversations/${conversationId}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    // Remove from list
                    setConversations(prev => prev.filter(c => c.id !== conversationId));

                    // If deleting current conversation, reset
                    if (conversationId === currentConversationId) {
                        setCurrentConversationId(null);
                    }
                }
            } catch (error) {
                console.error('Error deleting conversation:', error);
                throw error;
            }
        },
        [session, currentConversationId]
    );

    /**
     * Save a message to the current conversation
     * Best-effort: doesn't throw errors to avoid disrupting UX
     */
    const saveMessage = useCallback(
        async (role: 'USER' | 'MODEL', parts: ContentPart[]) => {
            if (!session?.user || !currentConversationId) {
                return;
            }

            try {
                await fetch(`/api/conversations/${currentConversationId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        role,
                        content: parts,
                    }),
                });
            } catch (error) {
                // Silent fail - don't disrupt user experience
                console.error('Error saving message:', error);
            }
        },
        [session, currentConversationId]
    );

    /**
     * Start a new conversation (reset state)
     */
    const startNewConversation = useCallback(() => {
        setCurrentConversationId(null);
    }, []);

    return {
        // State
        conversations,
        currentConversationId,
        isLoading,

        // Computed
        currentConversation,

        // Actions
        loadConversations,
        createConversation,
        loadConversation,
        updateConversationTitle,
        deleteConversation,
        saveMessage,
        startNewConversation,
    };
}
```

---

### 3. Refactored app/page.tsx

**Before:** 800+ lines with mixed concerns

**After:** ~500 lines with clear separation

```typescript
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useConversations } from '@/hooks/useConversations';
import ChatInput from '@/components/ChatInput';
import ChatMessage from '@/components/ChatMessage';
// ... other imports

export default function Home() {
    // Use custom hook
    const {
        conversations,
        currentConversationId,
        currentConversation,
        loadConversations,
        createConversation,
        loadConversation,
        deleteConversation,
        saveMessage,
        startNewConversation,
    } = useConversations();

    // UI-specific state (remaining in component)
    const [messages, setMessages] = useState<Message[]>([/* init message */]);
    const [isLoading, setIsLoading] = useState(false);
    const [mode, setMode] = useState<GenerationMode>('chat');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [isDjShachoMode, setIsDjShachoMode] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Load conversations on mount
    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    // Simplified message handling
    const handleSendMessage = async (prompt: string, uploadedMedia?: Media) => {
        if (isLoading) return;
        setIsLoading(true);

        // Add user message
        const userParts: ContentPart[] = [];
        if (prompt) userParts.push({ text: prompt });
        if (uploadedMedia) userParts.push({ media: uploadedMedia });
        addMessage({ role: 'user', parts: userParts });

        // Create/get conversation
        await createConversation(mode);

        // Save user message
        await saveMessage('USER', userParts);

        // ... rest of Gemini API call logic
    };

    // Simplified conversation loading
    const handleLoadConversation = async (conversationId: string) => {
        const loadedMessages = await loadConversation(conversationId);
        setMessages(loadedMessages);
        setIsSidebarOpen(false);
    };

    // Simplified new conversation
    const handleNewConversation = () => {
        startNewConversation();
        setMessages([/* initial message */]);
        setIsSidebarOpen(false);
    };

    return (
        // ... JSX with simplified handlers
    );
}
```

---

## Benefits Analysis

### 1. Code Organization

**Before:**
```
app/page.tsx (800+ lines)
├── State (8 pieces)
├── Conversation Logic (6 functions)
├── UI Logic (3 functions)
├── Effects (3 useEffect)
└── JSX (200+ lines)
```

**After:**
```
app/page.tsx (~500 lines)
├── useConversations() Hook
├── UI State (5 pieces)
├── UI Logic (3 functions)
├── Effects (2 useEffect)
└── JSX (200+ lines)

hooks/useConversations.ts (~200 lines)
├── Conversation State (3 pieces)
├── Conversation Logic (7 functions)
└── Well-documented, testable
```

---

### 2. Reusability

**Use Cases:**
- **Admin Dashboard:** 管理者が全ユーザーの会話を閲覧
- **Mobile App:** 別UIで同じ会話ロジックを使用
- **Embedded Chat Widget:** サイト内埋め込みチャット

**Example: Admin Page**
```typescript
// app/admin/conversations/page.tsx
import { useConversations } from '@/hooks/useConversations';

export default function AdminConversationsPage() {
    const { conversations, loadConversations, deleteConversation } = useConversations();

    // Admin-specific UI
    return (
        <div>
            {conversations.map(conv => (
                <AdminConversationCard
                    key={conv.id}
                    conversation={conv}
                    onDelete={deleteConversation}
                />
            ))}
        </div>
    );
}
```

---

### 3. Testability

**Before:** Difficult to test conversation logic in isolation

**After:** Easy to test hook independently

```typescript
// __tests__/hooks/useConversations.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { useConversations } from '@/hooks/useConversations';

describe('useConversations', () => {
    it('should load conversations on mount', async () => {
        const { result } = renderHook(() => useConversations());

        act(() => {
            result.current.loadConversations();
        });

        await waitFor(() => {
            expect(result.current.conversations).toHaveLength(5);
        });
    });

    it('should create new conversation', async () => {
        const { result } = renderHook(() => useConversations());

        let conversationId: string;
        await act(async () => {
            conversationId = await result.current.createConversation('chat');
        });

        expect(conversationId).toBeDefined();
        expect(result.current.currentConversationId).toBe(conversationId);
    });
});
```

---

### 4. Maintainability

**Conversation logic changes isolated to one file:**
- API endpoint変更 → `hooks/useConversations.ts` のみ修正
- 新しい会話機能追加 → Hook に関数追加、既存コンポーネント影響なし
- バグ修正 → Hook内で完結

---

## Migration Strategy

### Phase 1: Hook Creation (1 day)
1. `hooks/useConversations.ts` 作成
2. 既存ロジックを移植
3. 型定義整備
4. JSDoc コメント追加

### Phase 2: Integration (1 day)
1. `app/page.tsx` でHook使用
2. 既存関数をHookの関数に置き換え
3. State管理の移行

### Phase 3: Testing (1 day)
1. Hook単体テスト作成
2. Integration test更新
3. E2E test確認

### Phase 4: Refine & Document (0.5 day)
1. コードレビュー
2. ドキュメント更新
3. 使用例追加

**Total Estimate:** 3.5 days

---

## Alternative Approaches Considered

### 1. Context API
**Pros:** Global state management
**Cons:** Overkill for current scale, adds complexity

**Verdict:** ❌ Not recommended for now

### 2. Zustand / Redux
**Pros:** Powerful state management
**Cons:** Additional dependency, learning curve

**Verdict:** ❌ Defer until app scales further

### 3. Custom Hook (Selected)
**Pros:** Simple, no dependencies, React idiomatic
**Cons:** Limited to React ecosystem

**Verdict:** ✅ Best fit for current needs

---

## Future Enhancements

### 1. Optimistic Updates
```typescript
const deleteConversation = useCallback(async (id: string) => {
    // Optimistic update
    setConversations(prev => prev.filter(c => c.id !== id));

    try {
        await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    } catch (error) {
        // Rollback on error
        await loadConversations();
        throw error;
    }
}, []);
```

### 2. Caching with SWR
```typescript
import useSWR from 'swr';

export function useConversations() {
    const { data, mutate } = useSWR('/api/conversations', fetcher);
    // ... use SWR for automatic revalidation
}
```

### 3. Real-time Updates (WebSocket)
```typescript
useEffect(() => {
    const ws = new WebSocket('/api/ws/conversations');
    ws.onmessage = (event) => {
        const update = JSON.parse(event.data);
        // Update conversations in real-time
    };
    return () => ws.close();
}, []);
```

---

## References

- [React Custom Hooks](https://reactjs.org/docs/hooks-custom.html)
- [Advanced React Hooks Patterns (2025)](https://www.angularminds.com/blog/advanced-react-hooks-patterns-and-best-practices)
- [React Hooks Best Practices](https://blog.logrocket.com/react-hooks-cheat-sheet-solutions-common-problems/)
- [Testing Custom Hooks](https://react-hooks-testing-library.com/)
