# Testing Plan - BlunaAI

## 概要

Next.js App RouterアプリケーションのAPI Routes、UIコンポーネント、統合機能のテスト戦略を定義します。

**Current Status (2025-12-17)**: 519 tests passing ✅

**Recent Updates:**
- Added comprehensive mode switching tests (21 tests)
- Added multi-mode conversation flow integration tests (57 tests)
- Added E2E mode switching tests (3 tests)
- Total test count increased from 185 to 519

**実装根拠:**
- [Next.js Testing with Vitest](https://nextjs.org/docs/app/guides/testing/vitest)
- [next-test-api-route-handler](https://www.npmjs.com/package/next-test-api-route-handler)
- [API Testing with Vitest in Next.js (2025)](https://medium.com/@sanduni.s/api-testing-with-vitest-in-next-js-a-practical-guide-to-mocking-vs-spying-5e5b37677533)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

---

## Recent Bug Fixes & Test Coverage (2025-12-17)

### Mode Switching Bug Fixes

Fixed critical bugs in mode switching functionality to ensure proper conversation history and mode persistence:

1. **BUG-1 & BUG-5: saveMessage mode parameter**
   - Fixed `saveMessage` calls to pass explicit mode parameter instead of relying on state
   - Prevents mode mismatch in database
   - Updated `app/page.tsx` in all generation handlers

2. **BUG-2: History filtering**
   - Added filtering to exclude image/video-only messages from chat history
   - Created `getChatHistory()` helper function that filters by mode
   - Prevents image/video content from interfering with text-only chat context

3. **BUG-3: Video generation race condition**
   - Fixed async polling race condition by capturing mode value before async operations
   - Prevents mode from changing during video generation polling

4. **BUG-4: Auto mode switch for image uploads**
   - Added automatic mode switch to 'search' when images are uploaded
   - Updated `ChatInput.tsx` to detect image uploads and switch mode
   - Includes toast notification to inform users

### New Test Files

1. **`__tests__/app/page-mode-handling.test.ts`** (21 tests)
   - Mode switching and conversation history tests
   - Validates mode persistence across conversations
   - Tests history filtering for different modes

2. **`__tests__/scenarios/multi-mode-flow.test.ts`** (57 tests)
   - Multi-mode conversation flow integration tests
   - Tests complex user journeys across different modes
   - Validates data consistency across mode switches

3. **`e2e/mode-switching.spec.ts`** (3 tests)
   - End-to-end mode switching tests
   - Browser-based validation of mode switching UX
   - Tests persistence and visual feedback

---

## Test Stack

### Unit & Integration Tests
- **Vitest** 4.0.8 - Fast unit test runner
- **@testing-library/react** 16.3.0 - React component testing
- **@testing-library/jest-dom** 6.9.1 - DOM matchers
- **happy-dom** 20.0.10 - Lightweight DOM implementation

### E2E Tests
- **Playwright** 1.56.1 - End-to-end browser testing

### API Mocking
- **vi.mock()** - Module-level mocking
- **vi.spyOn()** - Function-level spying
- **next-test-api-route-handler** (推奨追加) - API Route testing utility

---

## Phase 1: Conversation API Tests

### 1.1 GET /api/conversations (List)

**Test File:** `__tests__/api/conversations/list.test.ts`

#### Happy Path
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

// Mock dependencies
vi.mock('next-auth');
vi.mock('@/lib/prisma', () => ({
    prisma: {
        conversation: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
    },
}));

describe('GET /api/conversations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return user conversations with pagination', async () => {
        // Arrange
        const mockSession = {
            user: { id: 'user_123', email: 'test@example.com' },
        };
        const mockConversations = [
            {
                id: 'conv_1',
                title: 'Test Conversation',
                mode: 'CHAT',
                createdAt: new Date('2025-11-13'),
                updatedAt: new Date('2025-11-13'),
                _count: { messages: 5 },
            },
        ];

        vi.mocked(getServerSession).mockResolvedValue(mockSession);
        vi.mocked(prisma.conversation.findMany).mockResolvedValue(mockConversations);
        vi.mocked(prisma.conversation.count).mockResolvedValue(1);

        // Act
        const response = await fetch('/api/conversations?limit=20&offset=0');
        const data = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(data.conversations).toHaveLength(1);
        expect(data.conversations[0].id).toBe('conv_1');
        expect(data.total).toBe(1);
        expect(prisma.conversation.findMany).toHaveBeenCalledWith({
            where: { userId: 'user_123' },
            select: expect.any(Object),
            orderBy: { updatedAt: 'desc' },
            take: 20,
            skip: 0,
        });
    });

    it('should support mode filtering', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' } };
        vi.mocked(getServerSession).mockResolvedValue(mockSession);
        vi.mocked(prisma.conversation.findMany).mockResolvedValue([]);
        vi.mocked(prisma.conversation.count).mockResolvedValue(0);

        // Act
        await fetch('/api/conversations?mode=IMAGE');

        // Assert
        expect(prisma.conversation.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { userId: 'user_123', mode: 'IMAGE' },
            })
        );
    });

    it('should limit results to max 100', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' } };
        vi.mocked(getServerSession).mockResolvedValue(mockSession);
        vi.mocked(prisma.conversation.findMany).mockResolvedValue([]);
        vi.mocked(prisma.conversation.count).mockResolvedValue(0);

        // Act
        await fetch('/api/conversations?limit=200');

        // Assert
        expect(prisma.conversation.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 100, // Max limit enforced
            })
        );
    });
});
```

#### Error Cases
```typescript
describe('GET /api/conversations - Error Cases', () => {
    it('should return 401 if not authenticated', async () => {
        // Arrange
        vi.mocked(getServerSession).mockResolvedValue(null);

        // Act
        const response = await fetch('/api/conversations');

        // Assert
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: 'Unauthorized' });
    });

    it('should return 500 on database error', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' } };
        vi.mocked(getServerSession).mockResolvedValue(mockSession);
        vi.mocked(prisma.conversation.findMany).mockRejectedValue(
            new Error('Database connection failed')
        );

        // Act
        const response = await fetch('/api/conversations');

        // Assert
        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({
            error: 'Failed to fetch conversations',
        });
    });
});
```

---

### 1.2 GET /api/conversations/[id]

**Test File:** `__tests__/api/conversations/get.test.ts`

#### Happy Path
```typescript
describe('GET /api/conversations/[id]', () => {
    it('should return conversation with messages', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' } };
        const mockConversation = {
            id: 'conv_1',
            userId: 'user_123',
            title: 'Test',
            mode: 'CHAT',
            createdAt: new Date(),
            updatedAt: new Date(),
            messages: [
                {
                    id: 'msg_1',
                    role: 'USER',
                    content: [{ text: 'Hello' }],
                    createdAt: new Date(),
                },
            ],
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation);

        // Act
        const response = await fetch('/api/conversations/conv_1');
        const data = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(data.conversation.id).toBe('conv_1');
        expect(data.conversation.messages).toHaveLength(1);
    });
});
```

#### Error Cases
```typescript
describe('GET /api/conversations/[id] - Error Cases', () => {
    it('should return 401 if not authenticated', async () => {
        vi.mocked(getServerSession).mockResolvedValue(null);

        const response = await fetch('/api/conversations/conv_1');

        expect(response.status).toBe(401);
    });

    it('should return 404 if conversation not found', async () => {
        const mockSession = { user: { id: 'user_123' } };
        vi.mocked(getServerSession).mockResolvedValue(mockSession);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null);

        const response = await fetch('/api/conversations/conv_1');

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: 'Conversation not found' });
    });

    it('should return 403 if user does not own conversation', async () => {
        const mockSession = { user: { id: 'user_123' } };
        const mockConversation = {
            id: 'conv_1',
            userId: 'other_user',  // Different user
            // ...
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation);

        const response = await fetch('/api/conversations/conv_1');

        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({
            error: expect.stringContaining('Forbidden'),
        });
    });
});
```

---

### 1.3 PATCH /api/conversations/[id]

**Test File:** `__tests__/api/conversations/update.test.ts`

#### Happy Path
```typescript
describe('PATCH /api/conversations/[id]', () => {
    it('should update conversation title', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' } };
        const mockExisting = { id: 'conv_1', userId: 'user_123' };
        const mockUpdated = {
            id: 'conv_1',
            title: 'New Title',
            mode: 'CHAT',
            updatedAt: new Date(),
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockExisting);
        vi.mocked(prisma.conversation.update).mockResolvedValue(mockUpdated);

        // Act
        const response = await fetch('/api/conversations/conv_1', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'New Title' }),
        });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(data.conversation.title).toBe('New Title');
        expect(prisma.conversation.update).toHaveBeenCalledWith({
            where: { id: 'conv_1' },
            data: { title: 'New Title' },
            select: expect.any(Object),
        });
    });
});
```

#### Error Cases
```typescript
describe('PATCH /api/conversations/[id] - Error Cases', () => {
    it('should return 400 on invalid title (too long)', async () => {
        const mockSession = { user: { id: 'user_123' } };
        vi.mocked(getServerSession).mockResolvedValue(mockSession);

        const longTitle = 'a'.repeat(201);  // Max 200 chars
        const response = await fetch('/api/conversations/conv_1', {
            method: 'PATCH',
            body: JSON.stringify({ title: longTitle }),
        });

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
            error: 'Invalid request body',
        });
    });

    it('should return 403 if user does not own conversation', async () => {
        const mockSession = { user: { id: 'user_123' } };
        const mockExisting = { id: 'conv_1', userId: 'other_user' };

        vi.mocked(getServerSession).mockResolvedValue(mockSession);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockExisting);

        const response = await fetch('/api/conversations/conv_1', {
            method: 'PATCH',
            body: JSON.stringify({ title: 'New Title' }),
        });

        expect(response.status).toBe(403);
    });
});
```

---

### 1.4 DELETE /api/conversations/[id]

**Test File:** `__tests__/api/conversations/delete.test.ts`

#### Happy Path
```typescript
describe('DELETE /api/conversations/[id]', () => {
    it('should delete conversation and cascade messages', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' } };
        const mockConversation = { id: 'conv_1', userId: 'user_123' };

        vi.mocked(getServerSession).mockResolvedValue(mockSession);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation);
        vi.mocked(prisma.conversation.delete).mockResolvedValue(mockConversation);

        // Act
        const response = await fetch('/api/conversations/conv_1', {
            method: 'DELETE',
        });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.deletedId).toBe('conv_1');
        expect(prisma.conversation.delete).toHaveBeenCalledWith({
            where: { id: 'conv_1' },
        });
    });
});
```

#### Error Cases
```typescript
describe('DELETE /api/conversations/[id] - Error Cases', () => {
    it('should return 404 if conversation not found', async () => {
        const mockSession = { user: { id: 'user_123' } };
        vi.mocked(getServerSession).mockResolvedValue(mockSession);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null);

        const response = await fetch('/api/conversations/conv_1', {
            method: 'DELETE',
        });

        expect(response.status).toBe(404);
    });

    it('should return 403 if user does not own conversation', async () => {
        const mockSession = { user: { id: 'user_123' } };
        const mockConversation = { id: 'conv_1', userId: 'other_user' };

        vi.mocked(getServerSession).mockResolvedValue(mockSession);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation);

        const response = await fetch('/api/conversations/conv_1', {
            method: 'DELETE',
        });

        expect(response.status).toBe(403);
    });
});
```

---

### 1.5 POST /api/conversations/[id]/messages

**Test File:** `__tests__/api/conversations/messages.test.ts`

#### Happy Path
```typescript
describe('POST /api/conversations/[id]/messages', () => {
    it('should create message in conversation', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' } };
        const mockConversation = { id: 'conv_1', userId: 'user_123' };
        const mockMessage = {
            id: 'msg_1',
            conversationId: 'conv_1',
            role: 'USER',
            content: [{ text: 'Hello' }],
            createdAt: new Date(),
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation);
        vi.mocked(prisma.message.create).mockResolvedValue(mockMessage);

        // Act
        const response = await fetch('/api/conversations/conv_1/messages', {
            method: 'POST',
            body: JSON.stringify({
                role: 'USER',
                content: [{ text: 'Hello' }],
            }),
        });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(201);
        expect(data.message.id).toBe('msg_1');
        expect(prisma.message.create).toHaveBeenCalledWith({
            data: {
                conversationId: 'conv_1',
                role: 'USER',
                content: [{ text: 'Hello' }],
            },
        });
    });
});
```

---

## Phase 2: Integration Testing Strategy

### 2.1 Setup Integration Tests

**Install Dependency:**
```bash
npm install -D next-test-api-route-handler
```

**Configuration:** `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'happy-dom',
        setupFiles: ['./vitest.setup.ts'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
        },
    },
});
```

**Setup File:** `vitest.setup.ts`
```typescript
import { afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Clean up mocks after each test
afterEach(() => {
    vi.clearAllMocks();
});

// Mock environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
```

---

### 2.2 Database Testing Strategy

#### Option 1: Mock Prisma (推奨 - Unit Tests)
```typescript
vi.mock('@/lib/prisma', () => ({
    prisma: {
        conversation: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
        message: {
            create: vi.fn(),
        },
    },
}));
```

#### Option 2: Test Database (Integration Tests)
```typescript
// Use a separate test database
// Run migrations before tests
// Clean up after tests

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.TEST_DATABASE_URL,
        },
    },
});

beforeAll(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE conversations CASCADE`;
});

afterAll(async () => {
    await prisma.$disconnect();
});
```

---

## Phase 3: E2E Testing with Playwright

### 3.1 Conversation Management E2E

**Test File:** `e2e/conversations.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Conversation Management', () => {
    test.beforeEach(async ({ page }) => {
        // Login with test account
        await page.goto('/');
        await page.click('[data-testid="login-button"]');
        // ... complete OAuth flow in test mode
    });

    test('should create and display new conversation', async ({ page }) => {
        await page.goto('/');

        // Send first message
        await page.fill('[data-testid="chat-input"]', 'Hello AI');
        await page.click('[data-testid="send-button"]');

        // Wait for response
        await page.waitForSelector('[data-testid="chat-message"]');

        // Open sidebar
        await page.click('[data-testid="sidebar-toggle"]');

        // Verify conversation appears in list
        const conversations = page.locator('[data-testid="conversation-item"]');
        await expect(conversations).toHaveCount(1);
    });

    test('should switch between conversations', async ({ page }) => {
        await page.goto('/');

        // Create first conversation
        await page.fill('[data-testid="chat-input"]', 'First message');
        await page.click('[data-testid="send-button"]');
        await page.waitForTimeout(1000);

        // Create second conversation
        await page.click('[data-testid="new-conversation"]');
        await page.fill('[data-testid="chat-input"]', 'Second message');
        await page.click('[data-testid="send-button"]');
        await page.waitForTimeout(1000);

        // Open sidebar and switch to first conversation
        await page.click('[data-testid="sidebar-toggle"]');
        const firstConv = page.locator('[data-testid="conversation-item"]').first();
        await firstConv.click();

        // Verify messages loaded
        const messages = page.locator('[data-testid="chat-message"]');
        await expect(messages).toContainText('First message');
    });

    test('should delete conversation', async ({ page }) => {
        await page.goto('/');

        // Create conversation
        await page.fill('[data-testid="chat-input"]', 'Test message');
        await page.click('[data-testid="send-button"]');
        await page.waitForTimeout(1000);

        // Open sidebar and delete
        await page.click('[data-testid="sidebar-toggle"]');
        await page.click('[data-testid="delete-conversation"]');

        // Confirm dialog
        page.on('dialog', dialog => dialog.accept());

        // Verify removed from list
        const conversations = page.locator('[data-testid="conversation-item"]');
        await expect(conversations).toHaveCount(0);
    });
});
```

---

## Phase 4: Stripe Webhook Manual Validation

### 4.1 Stripe CLI Setup

**Install Stripe CLI:**
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Linux
curl -L https://github.com/stripe/stripe-cli/releases/latest/download/stripe_linux_x86_64.tar.gz | tar -xz

# Login to Stripe
stripe login
```

**Forward Webhooks to Local:**
```bash
# Start webhook forwarding
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Copy the webhook signing secret (whsec_...)
# Add to .env.local as STRIPE_WEBHOOK_SECRET
```

### 4.2 Manual Test Scenarios

#### 4.2.1 Subscription Created
```bash
# Trigger checkout.session.completed event
stripe trigger checkout.session.completed

# Expected Results:
# 1. Check logs: "Webhook received: checkout.session.completed"
# 2. Verify Subscription record created in database
# 3. Verify User.stripeCustomerId populated
# 4. Verify status is ACTIVE or TRIALING
```

#### 4.2.2 Payment Failed
```bash
# Trigger invoice.payment_failed event
stripe trigger invoice.payment_failed

# Expected Results:
# 1. Subscription status updated to PAST_DUE
# 2. Email notification sent to user (if implemented)
```

#### 4.2.3 Subscription Canceled
```bash
# Trigger customer.subscription.deleted event
stripe trigger customer.subscription.deleted

# Expected Results:
# 1. Subscription status updated to CANCELED
# 2. User downgraded to FREE plan
# 3. UsageLogs still retained
```

---

## Phase 5: Usage Limit Manual Validation

### 5.1 Setup Test Environment

**Create Test Users with Different Plans:**
```sql
-- Run in Prisma Studio or PostgreSQL client
-- 1. FREE plan user (user_free)
-- 2. PRO plan user (user_pro)
-- 3. ENTERPRISE plan user (user_enterprise)
-- 4. User with no subscription (user_none)
```

**Generate Auth Tokens:**
```bash
# Login as each test user and extract session token
# Use browser DevTools > Application > Cookies > next-auth.session-token
```

### 5.2 Test Scenarios

#### 5.2.1 Authentication Required (401)

**Scenario:** Access Gemini API without authentication

**Test Commands:**
```bash
# Chat API
curl -X POST http://localhost:3000/api/gemini/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test", "mode": "chat", "history": []}'

# Image API
curl -X POST http://localhost:3000/api/gemini/image \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test image"}'

# Video API
curl -X POST http://localhost:3000/api/gemini/video \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test video"}'
```

**Expected Results:**
- HTTP Status: `401 Unauthorized`
- Response Body: `{"error": "Unauthorized"}`
- No UsageLog entry created

---

#### 5.2.2 FREE Plan Restrictions (403)

**Scenario:** FREE plan user tries Pro Mode

**Test Command:**
```bash
# Login as user_free, extract Cookie header from browser
curl -X POST http://localhost:3000/api/gemini/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<token>" \
  -d '{
    "prompt": "Analyze this problem",
    "mode": "pro",
    "history": []
  }'
```

**Expected Results:**
- HTTP Status: `403 Forbidden`
- Response Body: `{"error": "Pro Mode not available in current plan"}`
- No UsageLog entry created

**Scenario:** FREE plan user tries Image Generation

**Test Command:**
```bash
curl -X POST http://localhost:3000/api/gemini/image \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<free_user_token>" \
  -d '{"prompt": "A beautiful sunset", "aspectRatio": "16:9"}'
```

**Expected Results:**
- HTTP Status: `403 Forbidden`
- Response Body: `{"error": "Image generation not available in current plan"}`

**Scenario:** FREE plan user tries Video Generation

**Test Command:**
```bash
curl -X POST http://localhost:3000/api/gemini/video \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<free_user_token>" \
  -d '{"prompt": "A cat playing piano", "aspectRatio": "16:9"}'
```

**Expected Results:**
- HTTP Status: `403 Forbidden`
- Response Body: `{"error": "Video generation not available in current plan"}`

---

#### 5.2.3 PRO Plan Restrictions (403)

**Scenario:** PRO plan user tries Video Generation (ENTERPRISE only)

**Test Command:**
```bash
curl -X POST http://localhost:3000/api/gemini/video \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<pro_user_token>" \
  -d '{"prompt": "A cat playing piano", "aspectRatio": "16:9"}'
```

**Expected Results:**
- HTTP Status: `403 Forbidden`
- Response Body: `{"error": "Video generation not available in current plan"}`

---

#### 5.2.4 Monthly Limit Exceeded (429)

**Scenario:** FREE plan user exceeds 100 requests/month

**Setup:**
```sql
-- Insert 100 usage logs for current month (user_free)
INSERT INTO "UsageLog" (id, "userId", action, metadata, "createdAt")
SELECT
  gen_random_uuid(),
  'user_free',
  'chat',
  '{"resourceType": "gemini-2.5-flash"}',
  NOW()
FROM generate_series(1, 100);
```

**Test Command:**
```bash
curl -i -X POST http://localhost:3000/api/gemini/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<free_user_token>" \
  -d '{"prompt": "101st request", "mode": "chat", "history": []}'
```

**Expected Results:**
- HTTP Status: `429 Too Many Requests`
- Response Headers: `Retry-After: 86400` (24 hours in seconds)
- Response Body: `{"error": "Monthly request limit exceeded"}`
- No UsageLog entry created for this request

**Scenario:** PRO plan user exceeds 1000 requests/month

**Setup:**
```sql
-- Insert 1000 usage logs for current month (user_pro)
INSERT INTO "UsageLog" (id, "userId", action, metadata, "createdAt")
SELECT
  gen_random_uuid(),
  'user_pro',
  'image_generation',
  '{"resourceType": "imagen-4.0"}',
  NOW()
FROM generate_series(1, 1000);
```

**Test Command:**
```bash
curl -i -X POST http://localhost:3000/api/gemini/image \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<pro_user_token>" \
  -d '{"prompt": "1001st request", "aspectRatio": "1:1"}'
```

**Expected Results:**
- HTTP Status: `429 Too Many Requests`
- Response Headers: `Retry-After: 86400`
- Response Body: `{"error": "Monthly request limit exceeded"}`

---

#### 5.2.5 Successful Usage Logging

**Scenario:** FREE plan user makes valid chat request (under limit)

**Test Command:**
```bash
curl -i -X POST http://localhost:3000/api/gemini/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<free_user_token>" \
  -d '{
    "prompt": "Hello AI",
    "mode": "chat",
    "history": []
  }'
```

**Expected Results:**
- HTTP Status: `200 OK`
- Response Body: Contains `result` with generated text
- UsageLog entry created with:
  - `userId`: user_free
  - `action`: "chat"
  - `metadata.resourceType`: "gemini-2.5-flash"
  - `metadata.mode`: "chat"
  - `createdAt`: current timestamp

**Verification Query:**
```sql
SELECT * FROM "UsageLog"
WHERE "userId" = 'user_free'
ORDER BY "createdAt" DESC
LIMIT 1;
```

**Scenario:** PRO plan user uses Pro Mode

**Test Command:**
```bash
curl -X POST http://localhost:3000/api/gemini/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<pro_user_token>" \
  -d '{
    "prompt": "Analyze this complex problem",
    "mode": "pro",
    "history": []
  }'
```

**Expected Results:**
- HTTP Status: `200 OK`
- UsageLog entry created with:
  - `action`: "pro_mode"
  - `metadata.resourceType`: "gemini-2.5-pro"
  - `metadata.mode`: "pro"

**Scenario:** ENTERPRISE plan user generates video (unlimited)

**Test Command:**
```bash
curl -X POST http://localhost:3000/api/gemini/video \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<enterprise_user_token>" \
  -d '{
    "prompt": "A cat playing piano",
    "aspectRatio": "16:9"
  }'
```

**Expected Results:**
- HTTP Status: `200 OK`
- Response Body: Contains `result.operationName`
- UsageLog entry created with:
  - `action`: "video_generation"
  - `metadata.resourceType`: "veo-3.1-fast"
  - `metadata.aspectRatio`: "16:9"

---

### 5.3 Dashboard Usage Display Validation

**Scenario:** Verify usage meter displays correctly

**Test Steps:**
1. Login as `user_pro` (PRO plan, 1000/month limit)
2. Navigate to `/dashboard`
3. Generate 500 chat requests (use script or manual)
4. Refresh dashboard

**Expected Results:**
- Usage Count: 500
- Limit: 1,000
- Usage Percentage: 50%
- Progress Bar: Green (< 80%)

**Test Steps (Over 80%):**
1. Generate additional 400 requests (total 900)
2. Refresh dashboard

**Expected Results:**
- Usage Count: 900
- Limit: 1,000
- Usage Percentage: 90%
- Progress Bar: Yellow (≥ 80%, < 100%)

**Test Steps (At Limit):**
1. Generate additional 100 requests (total 1000)
2. Refresh dashboard

**Expected Results:**
- Usage Count: 1,000
- Limit: 1,000
- Usage Percentage: 100%
- Progress Bar: Red (≥ 100%)
- Next request should return 429

---

### 5.4 Validation Checklist

**Authentication & Authorization:**
- [ ] 401 returned for unauthenticated requests
- [ ] Session token correctly validated via NextAuth

**Plan Restrictions:**
- [ ] FREE plan: Can use chat/search only (100/month)
- [ ] FREE plan: Cannot use Pro Mode (403)
- [ ] FREE plan: Cannot use Image Generation (403)
- [ ] FREE plan: Cannot use Video Generation (403)
- [ ] PRO plan: Can use chat/search/pro/image (1000/month)
- [ ] PRO plan: Cannot use Video Generation (403)
- [ ] ENTERPRISE plan: Can use all features (unlimited)

**Rate Limiting:**
- [ ] 429 returned when monthly limit exceeded
- [ ] Retry-After: 86400 header present on 429 responses
- [ ] No UsageLog entry created for 429 responses

**Usage Logging:**
- [ ] UsageLog entry created after successful request
- [ ] Correct `action` field (chat, pro_mode, image_generation, video_generation)
- [ ] Correct `resourceType` in metadata
- [ ] Additional metadata captured (mode, aspectRatio, etc.)

**Resource Type Tracking:**
- [ ] Chat mode: gemini-2.5-flash
- [ ] Pro mode: gemini-2.5-pro
- [ ] Search mode: gemini-2.5-flash-grounded
- [ ] Image generation: imagen-4.0
- [ ] Image editing: gemini-2.5-flash-image
- [ ] Video generation: veo-3.1-fast

**Dashboard Display:**
- [ ] Current usage count accurate
- [ ] Monthly limit correct per plan
- [ ] Usage percentage calculated correctly
- [ ] Progress bar color changes (green → yellow → red)
- [ ] Billing period dates displayed correctly

---

## Test Coverage Goals

### Unit Tests
- **API Routes**: 80%+ coverage
- **Utility Functions**: 90%+ coverage
- **Validators**: 100% coverage

### Integration Tests
- **Critical User Flows**: 100%
- **Error Scenarios**: Key paths covered

### E2E Tests
- **Happy Paths**: All primary features
- **Cross-browser**: Chrome, Firefox, Safari

---

## Running Tests

### Unit & Integration Tests
```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Watch mode
npm test -- --watch

# Run specific file
npm test -- __tests__/api/conversations/list.test.ts
```

### E2E Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run specific browser
npm run test:e2e -- --project=chromium

# Debug mode
npm run test:e2e -- --debug
```

---

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test -- --coverage

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Phase 6: Admin UI Testing

### Overview

Admin UI pages (`/admin/users`, `/admin/usage`, `/admin/subscriptions`) require comprehensive testing for:
- **RBAC verification**: 401/403 status codes for unauthorized access
- **Component functionality**: Filters, search, pagination, modals
- **Data display**: Table rendering, loading states, error handling
- **E2E flows**: Complete admin workflows with authentication

---

### 6.1 Admin Users Page Tests

**Test File:** `__tests__/app/admin/users.test.tsx` (Component Test)

#### Component Rendering
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import UsersPage from '@/app/admin/users/page';

// Mock next-auth
vi.mock('next-auth/react', () => ({
    SessionProvider: ({ children }: any) => children,
    useSession: () => ({
        data: { user: { id: 'admin_123', role: 'ADMIN' } },
        status: 'authenticated',
    }),
}));

// Mock fetch
global.fetch = vi.fn();

describe('Admin Users Page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render users table with data', async () => {
        // Arrange
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                users: [
                    {
                        id: 'user_1',
                        email: 'user1@example.com',
                        name: 'User One',
                        role: 'USER',
                        createdAt: '2025-11-13T00:00:00.000Z',
                        subscription: {
                            planName: 'FREE',
                            status: 'ACTIVE',
                            currentPeriodEnd: '2025-12-31T23:59:59.999Z',
                        },
                        usageStats: {
                            totalRequests: 50,
                            currentMonthRequests: 10,
                        },
                        lastActiveAt: '2025-11-13T12:00:00.000Z',
                    },
                ],
                total: 1,
                limit: 20,
                offset: 0,
            }),
        });

        // Act
        render(<UsersPage />);

        // Assert
        await waitFor(() => {
            expect(screen.getByText('user1@example.com')).toBeInTheDocument();
            expect(screen.getByText('User One')).toBeInTheDocument();
            expect(screen.getByText('FREE')).toBeInTheDocument();
        });
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/admin/users')
        );
    });

    it('should display loading state', () => {
        // Arrange
        (global.fetch as any).mockReturnValue(
            new Promise(() => {}) // Never resolves
        );

        // Act
        render(<UsersPage />);

        // Assert
        expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should display error message on fetch failure', async () => {
        // Arrange
        (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

        // Act
        render(<UsersPage />);

        // Assert
        await waitFor(() => {
            expect(screen.getByText(/error/i)).toBeInTheDocument();
        });
    });
});
```

#### Search and Filter Tests
```typescript
it('should update URL params when search is applied', async () => {
    // Arrange
    const { getByPlaceholderText } = render(<UsersPage />);
    const searchInput = getByPlaceholderText(/search/i);

    // Act
    fireEvent.change(searchInput, { target: { value: 'john' } });
    await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('search=john')
        );
    });
});

it('should filter by role', async () => {
    // Arrange
    const { getByLabelText } = render(<UsersPage />);
    const roleSelect = getByLabelText(/role/i);

    // Act
    fireEvent.change(roleSelect, { target: { value: 'PRO' } });

    // Assert
    await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('role=PRO')
        );
    });
});
```

---

### 6.2 Admin Usage Page Tests

**Test File:** `__tests__/app/admin/usage.test.tsx` (Component Test)

#### Date Range Filter
```typescript
it('should apply date range filter', async () => {
    // Arrange
    const { getByLabelText } = render(<UsagePage />);
    const startDateInput = getByLabelText(/start date/i);
    const endDateInput = getByLabelText(/end date/i);

    // Act
    fireEvent.change(startDateInput, { target: { value: '2025-11-01' } });
    fireEvent.change(endDateInput, { target: { value: '2025-11-30' } });

    // Assert
    await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('startDate=2025-11-01')
        );
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('endDate=2025-11-30')
        );
    });
});
```

---

### 6.3 E2E Tests with Playwright

**Test File:** `e2e/admin/users.spec.ts`

#### RBAC Verification (401/403 Paths)
```typescript
import { test, expect } from '@playwright/test';

test.describe('Admin Users Page - RBAC', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
        // Act
        await page.goto('/admin/users');

        // Assert
        await expect(page).toHaveURL(/.*\/api\/auth\/signin/);
    });

    test('should show 403 for non-ADMIN users', async ({ page }) => {
        // Arrange: Login as regular USER
        await page.goto('/api/auth/signin');
        await page.fill('input[name="email"]', 'user@example.com');
        await page.fill('input[name="password"]', 'password');
        await page.click('button[type="submit"]');

        // Act: Try to access admin page
        await page.goto('/admin/users');

        // Assert: Should see 403 error
        await expect(page.locator('text=403')).toBeVisible();
        await expect(page.locator('text=/forbidden/i')).toBeVisible();
    });

    test('should allow ADMIN users to access page', async ({ page }) => {
        // Arrange: Login as ADMIN
        await page.goto('/api/auth/signin');
        await page.fill('input[name="email"]', 'admin@example.com');
        await page.fill('input[name="password"]', 'admin_password');
        await page.click('button[type="submit"]');

        // Act
        await page.goto('/admin/users');

        // Assert
        await expect(page.locator('h1')).toContainText(/users/i);
        await expect(page.locator('table')).toBeVisible();
    });
});
```

#### Complete Admin Workflow
```typescript
test.describe('Admin Users Page - User Management', () => {
    test.beforeEach(async ({ page }) => {
        // Login as ADMIN before each test
        await page.goto('/api/auth/signin');
        await page.fill('input[name="email"]', 'admin@example.com');
        await page.fill('input[name="password"]', 'admin_password');
        await page.click('button[type="submit"]');
        await page.waitForURL('/');
    });

    test('should search for users', async ({ page }) => {
        // Act
        await page.goto('/admin/users');
        await page.fill('input[placeholder*="Search"]', 'john');
        await page.keyboard.press('Enter');

        // Assert
        await expect(page.locator('table tbody tr')).toHaveCount.greaterThan(0);
        await expect(page.locator('table').first()).toContainText('john');
    });

    test('should filter by role', async ({ page }) => {
        // Act
        await page.goto('/admin/users');
        await page.selectOption('select[name="role"]', 'PRO');

        // Assert
        await page.waitForResponse(/\/api\/admin\/users\?.*role=PRO/);
        await expect(page.locator('table tbody tr')).toHaveCount.greaterThan(0);
    });

    test('should update user role via modal', async ({ page }) => {
        // Act
        await page.goto('/admin/users');
        await page.click('button:has-text("Update Role")').first();

        // Assert modal opens
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        // Act: Change role
        await page.selectOption('select[name="newRole"]', 'ADMIN');
        await page.click('button:has-text("Save")');

        // Assert: Success message
        await expect(page.locator('text=/success/i')).toBeVisible();

        // Assert: AuditLog created (verify in DB or via API)
        const auditLog = await fetch('/api/admin/audit?action=admin.users.update_role');
        expect(auditLog.ok).toBe(true);
    });

    test('should paginate through users', async ({ page }) => {
        // Act
        await page.goto('/admin/users');
        const initialCount = await page.locator('table tbody tr').count();

        // Go to next page
        await page.click('button:has-text("Next")');
        await page.waitForResponse(/\/api\/admin\/users\?.*offset=20/);

        // Assert: Different users displayed
        const newCount = await page.locator('table tbody tr').count();
        expect(newCount).toBeGreaterThan(0);
    });
});
```

---

### 6.4 Admin Usage Page E2E

**Test File:** `e2e/admin/usage.spec.ts`

```typescript
test.describe('Admin Usage Page - Monitoring', () => {
    test.beforeEach(async ({ page }) => {
        // Login as ADMIN
        await page.goto('/api/auth/signin');
        await page.fill('input[name="email"]', 'admin@example.com');
        await page.fill('input[name="password"]', 'admin_password');
        await page.click('button[type="submit"]');
    });

    test('should display usage logs table', async ({ page }) => {
        await page.goto('/admin/usage');

        // Assert
        await expect(page.locator('h1')).toContainText(/usage/i);
        await expect(page.locator('table')).toBeVisible();
        await expect(page.locator('table th')).toContainText(['User', 'Action', 'Resource']);
    });

    test('should filter by date range', async ({ page }) => {
        await page.goto('/admin/usage');

        // Act
        await page.fill('input[name="startDate"]', '2025-11-01');
        await page.fill('input[name="endDate"]', '2025-11-30');
        await page.click('button:has-text("Apply")');

        // Assert
        await page.waitForResponse(/\/api\/admin\/usage\?.*startDate=2025-11-01/);
        await expect(page.locator('table tbody tr')).toHaveCount.greaterThan(0);
    });

    test('should filter by action type', async ({ page }) => {
        await page.goto('/admin/usage');

        // Act
        await page.selectOption('select[name="action"]', 'chat');

        // Assert
        await page.waitForResponse(/\/api\/admin\/usage\?.*action=chat/);
        await expect(page.locator('table tbody tr td')).toContainText('chat');
    });
});
```

---

### 6.5 Testing Checklist

#### Component Tests (Vitest + @testing-library/react)
- [ ] Users Page renders correctly with data
- [ ] Users Page shows loading state during fetch
- [ ] Users Page displays error message on fetch failure
- [ ] Search filter updates URL params correctly
- [ ] Role filter applies correctly
- [ ] Plan filter applies correctly
- [ ] Pagination controls work (prev/next buttons)
- [ ] Update Role modal opens and closes
- [ ] Update Role modal validates input
- [ ] Update Role modal calls API correctly
- [ ] Usage Page renders logs table
- [ ] Usage Page date range filter works
- [ ] Usage Page action filter works
- [ ] Usage Page resource type filter works

#### E2E Tests (Playwright)
- [ ] **401 Path**: Unauthenticated users redirected to login
- [ ] **403 Path**: Non-ADMIN users see 403 error
- [ ] **200 Path**: ADMIN users can access /admin/users
- [ ] **200 Path**: ADMIN users can access /admin/usage
- [ ] Search functionality works end-to-end
- [ ] Role filter works end-to-end
- [ ] Date range filter works end-to-end
- [ ] Update role workflow completes successfully
- [ ] AuditLog is created for role updates
- [ ] Pagination works across multiple pages
- [ ] Mobile responsiveness verified

#### Manual Testing
- [ ] Login as ADMIN user in dev environment
- [ ] Verify all filters apply correctly
- [ ] Verify pagination navigation
- [ ] Verify role update modal workflow
- [ ] Test on mobile device (responsive design)
- [ ] Test browser back/forward navigation
- [ ] Verify error handling for network failures
- [ ] Verify loading states during data fetch

---

### 6.6 Example Test Commands

```bash
# Run all Admin UI component tests
npm test -- __tests__/app/admin/

# Run specific Admin Users tests
npm test -- __tests__/app/admin/users.test.tsx

# Run E2E tests for Admin pages
npm run test:e2e -- e2e/admin/

# Run E2E with UI (for debugging)
npm run test:e2e:ui -- e2e/admin/users.spec.ts

# Run tests in watch mode during development
npm test -- __tests__/app/admin/ --watch
```

---

## Phase 7: React 18 StrictMode Testing Patterns

### 7.1 Overview

React 18's StrictMode intentionally **double-invokes effects** in development to help detect side effects. This causes `useEffect` hooks to run in the following sequence:

1. **Mount**: Component renders, effect runs
2. **Unmount**: Effect cleanup runs (simulated)
3. **Remount**: Component re-renders, effect runs again

**Impact on Tests**: Any component using `useEffect` to fetch data will make **3 fetch calls** during initial render, not 1.

**Why This Matters**:
- Custom fetch mocks that don't account for this behavior will fail
- Tests will timeout waiting for data that never arrives
- Error messages like "Unexpected end of JSON input" or "Cannot read properties of undefined"

---

### 7.2 vitest-fetch-mock Setup

#### Installation

**Already installed** in this project:
```bash
npm install -D vitest-fetch-mock
```

#### Configuration

**File:** `vitest.setup.ts`

```typescript
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import createFetchMock from 'vitest-fetch-mock';

// Initialize vitest-fetch-mock
const fetchMock = createFetchMock(vi);
fetchMock.enableMocks();

// Reset fetch mocks before each test
beforeEach(() => {
    fetchMock.resetMocks();
});

// Mock environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-vitest';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.GEMINI_API_KEY = 'test-gemini-api-key';

// Cleanup after each test
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});
```

**Type Definitions:** `vitest-env.d.ts`

```typescript
/// <reference types="vitest" />
/// <reference types="@testing-library/jest-dom" />

import type {FetchMock} from 'vitest-fetch-mock';

declare global {
  const fetchMock: FetchMock;
  // eslint-disable-next-line no-var
  var fetch: FetchMock;
}

export {};
```

---

### 7.3 Common Testing Patterns

#### Pattern 1: Initial Render (3 Fetches)

**Scenario**: Component fetches data on mount with no user interaction.

**Expected Fetch Count**: **3 calls** (mount, unmount, remount)

```typescript
it('should render table with data', async () => {
    // Arrange
    const mockData = createMockData(3);
    const mockResponse = JSON.stringify({
        data: mockData,
        total: 3,
    });

    // StrictMode: 3 initial fetches (mount, unmount, remount)
    fetch.mockResponseOnce(mockResponse); // Mount
    fetch.mockResponseOnce(mockResponse); // Unmount
    fetch.mockResponseOnce(mockResponse); // Remount

    // Act
    render(<MyComponent />);

    // Assert: Should show loading initially
    expect(screen.getByText(/読み込み中/i)).toBeInTheDocument();

    // Wait for loading to disappear
    await waitFor(() => {
        expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify data is displayed
    expect(screen.getByText('Expected Data')).toBeInTheDocument();
});
```

---

#### Pattern 2: User Interaction (4 Fetches)

**Scenario**: Component renders, then user changes a filter/input, triggering a re-fetch.

**Expected Fetch Count**: **4 calls** (3 initial + 1 user action)

```typescript
it('should update filter and trigger fetch', async () => {
    // Arrange
    const mockData = createMockData(1);
    const mockResponse = JSON.stringify({ data: mockData, total: 1 });

    // StrictMode: 3 initial fetches + 1 filter change = 4 total
    fetch.mockResponseOnce(mockResponse); // Mount
    fetch.mockResponseOnce(mockResponse); // Unmount
    fetch.mockResponseOnce(mockResponse); // Remount
    fetch.mockResponseOnce(mockResponse); // After filter change

    // Act
    render(<MyComponent />);

    await waitFor(() => {
        expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // User changes filter
    const filterInput = screen.getByPlaceholderText(/検索/i);
    fireEvent.change(filterInput, { target: { value: 'test' } });

    // Assert - Wait for re-fetch with filter param
    await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('filter=test'),
            undefined
        );
    }, { timeout: 3000 });
});
```

---

#### Pattern 3: Error Handling (3 Rejections)

**Scenario**: Component attempts to fetch data but network request fails.

**Expected Behavior**: **3 rejected promises** (all must fail consistently)

```typescript
it('should display error message on fetch failure', async () => {
    // Arrange - StrictMode: 3 fetch calls (mount, unmount, remount)
    fetch.mockRejectOnce(new Error('Network error'));
    fetch.mockRejectOnce(new Error('Network error'));
    fetch.mockRejectOnce(new Error('Network error'));

    // Act
    render(<MyComponent />);

    // Assert - Wait for loading to disappear
    await waitFor(() => {
        expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify error message is displayed
    expect(screen.getByText(/エラー/i)).toBeInTheDocument();
    expect(screen.getByText(/Network error/i)).toBeInTheDocument();
});
```

---

#### Pattern 4: Loading State (Blocked Fetch)

**Scenario**: Test that component displays loading indicator while fetch is in progress.

**Expected Behavior**: Fetch never resolves, component remains in loading state.

```typescript
it('should display loading state', () => {
    // Arrange: Mock fetch that never resolves (blocks indefinitely)
    fetch.mockAbort();

    // Act
    render(<MyComponent />);

    // Assert
    expect(screen.getByText(/読み込み中/i)).toBeInTheDocument();
});
```

---

#### Pattern 5: Update with Refresh (5+ Fetches)

**Scenario**: User updates data via PATCH/PUT, then component re-fetches to show updated state.

**Expected Fetch Count**: **5 calls** (3 initial + 1 PATCH + 1 GET refresh)

```typescript
it('should update data and refresh', async () => {
    // Arrange
    const initialData = createMockData(1);
    const updatedData = { ...initialData[0], name: 'Updated' };

    const getResponse = JSON.stringify({ data: initialData, total: 1 });
    const patchResponse = JSON.stringify({ data: updatedData });

    // StrictMode: 3 initial GET + 1 PATCH + 1 GET refresh = 5 total
    fetch.mockResponseOnce(getResponse); // Mount
    fetch.mockResponseOnce(getResponse); // Unmount
    fetch.mockResponseOnce(getResponse); // Remount
    fetch.mockResponseOnce(patchResponse); // PATCH update
    fetch.mockResponseOnce(JSON.stringify({ data: [updatedData], total: 1 })); // GET refresh

    // Act
    render(<MyComponent />);

    await waitFor(() => {
        expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
    });

    // User clicks update button
    const updateButton = screen.getByText(/更新/i);
    fireEvent.click(updateButton);

    // Assert - Verify PATCH was called
    await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/data/1'),
            expect.objectContaining({ method: 'PATCH' })
        );
    });

    // Verify updated data is displayed
    expect(screen.getByText('Updated')).toBeInTheDocument();
});
```

---

#### Pattern 6: Modal Interactions (3 Fetches, No Additional)

**Scenario**: User opens a modal or expands UI elements that **don't trigger fetch**.

**Expected Fetch Count**: **3 calls** (only initial render)

```typescript
it('should open modal without triggering fetch', async () => {
    // Arrange
    const mockData = createMockData(1);
    const mockResponse = JSON.stringify({ data: mockData, total: 1 });

    // StrictMode: 3 initial fetches (modal open doesn't trigger fetch)
    fetch.mockResponseOnce(mockResponse); // Mount
    fetch.mockResponseOnce(mockResponse); // Unmount
    fetch.mockResponseOnce(mockResponse); // Remount

    // Act
    render(<MyComponent />);

    await waitFor(() => {
        expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
    });

    // User opens modal
    const openButton = screen.getByText(/開く/i);
    fireEvent.click(openButton);

    // Assert - Modal is visible
    await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Verify fetch was only called 3 times (no additional fetch)
    expect(fetch).toHaveBeenCalledTimes(3);
});
```

---

### 7.4 vitest-fetch-mock API Reference

#### Common Methods

```typescript
// Mock a single response
fetch.mockResponseOnce(JSON.stringify({ data: 'value' }));

// Mock a single response with options
fetch.mockResponseOnce(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

// Mock a single error/rejection
fetch.mockRejectOnce(new Error('Network error'));

// Block fetch indefinitely (for loading state tests)
fetch.mockAbort();

// Reset all mocks (called automatically in beforeEach)
fetch.mockReset();

// Clear call history
fetch.mockClear();

// Persistent mock (applies to all subsequent fetch calls)
fetch.mockResponse(JSON.stringify({ data: 'persistent' }));
```

---

### 7.5 Common Pitfalls and Troubleshooting

#### Issue 1: Test Timeout

**Symptom**: Test times out waiting for elements to appear.

**Cause**: Not enough `mockResponseOnce()` calls to satisfy StrictMode's 3 fetches.

**Fix**: Add 3 mock responses for initial render.

```typescript
// ❌ WRONG: Only 1 mock response
fetch.mockResponseOnce(mockResponse);
render(<MyComponent />);

// ✅ CORRECT: 3 mock responses for StrictMode
fetch.mockResponseOnce(mockResponse); // Mount
fetch.mockResponseOnce(mockResponse); // Unmount
fetch.mockResponseOnce(mockResponse); // Remount
render(<MyComponent />);
```

---

#### Issue 2: "Unexpected end of JSON input"

**Symptom**: Error message about invalid JSON.

**Cause**: Custom fetch mock returning non-Response object.

**Fix**: Use `vitest-fetch-mock` instead of custom implementation.

```typescript
// ❌ WRONG: Custom fetch mock returning plain objects
global.fetch = vi.fn(() => Promise.resolve({ json: () => data }));

// ✅ CORRECT: Use vitest-fetch-mock
import createFetchMock from 'vitest-fetch-mock';
const fetchMock = createFetchMock(vi);
fetchMock.enableMocks();
fetch.mockResponseOnce(JSON.stringify(data));
```

---

#### Issue 3: "Cannot read properties of undefined"

**Symptom**: Component state is undefined during assertions.

**Cause**: Fetch mock queue exhausted before StrictMode completes all 3 calls.

**Fix**: Provide sufficient mock responses.

```typescript
// ❌ WRONG: Only 2 responses, StrictMode needs 3
fetch.mockResponseOnce(mockResponse);
fetch.mockResponseOnce(mockResponse);
render(<MyComponent />); // 3rd fetch will fail

// ✅ CORRECT: 3 responses
fetch.mockResponseOnce(mockResponse);
fetch.mockResponseOnce(mockResponse);
fetch.mockResponseOnce(mockResponse);
render(<MyComponent />);
```

---

#### Issue 4: Fetch Called More Times Than Expected

**Symptom**: `expect(fetch).toHaveBeenCalledTimes(4)` fails, actual is 5 or 6.

**Cause**: Multiple filters/dependencies in `useEffect` causing additional re-renders.

**Fix**: Add explicit comments documenting expected count, debug with `console.log(fetch.mock.calls.length)`.

```typescript
it('should handle multiple filter changes', async () => {
    const mockResponse = JSON.stringify({ data: [], total: 0 });

    // StrictMode: 3 initial + 2 filter changes = 5 total
    fetch.mockResponseOnce(mockResponse); // Mount
    fetch.mockResponseOnce(mockResponse); // Unmount
    fetch.mockResponseOnce(mockResponse); // Remount
    fetch.mockResponseOnce(mockResponse); // Filter 1 change
    fetch.mockResponseOnce(mockResponse); // Filter 2 change

    render(<MyComponent />);

    // Debug: Log actual call count
    console.log('Fetch called:', fetch.mock.calls.length);

    // Change first filter
    fireEvent.change(filter1Input, { target: { value: 'value1' } });

    // Change second filter
    fireEvent.change(filter2Input, { target: { value: 'value2' } });

    await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(5);
    });
});
```

---

### 7.6 Testing Checklist

#### Setup Verification
- [ ] `vitest-fetch-mock` installed (`npm list vitest-fetch-mock`)
- [ ] `vitest.setup.ts` uses `createFetchMock(vi)`
- [ ] `beforeEach` calls `fetchMock.resetMocks()`
- [ ] `vitest-env.d.ts` declares global `fetch` type

#### Test Pattern Verification
- [ ] Initial render tests use 3 `mockResponseOnce()` calls
- [ ] User interaction tests use 4 calls (3 + 1)
- [ ] Error tests use 3 `mockRejectOnce()` calls
- [ ] Modal/expand tests use only 3 calls (no additional)
- [ ] Update with refresh tests use 5+ calls (3 + PATCH + GET)
- [ ] Each test has comments documenting expected fetch count

#### Troubleshooting
- [ ] All tests pass without timeouts
- [ ] No "Unexpected end of JSON input" errors
- [ ] No "Cannot read properties of undefined" errors
- [ ] `fetch.mock.calls.length` matches expectations
- [ ] Tests run reliably in CI/CD environment

---

### 7.7 Example Test Commands

```bash
# Run all component tests with StrictMode patterns
npm test -- __tests__/app/admin/

# Run specific test file
npm test -- __tests__/app/admin/users.test.tsx

# Run with verbose output to see fetch call counts
npm test -- __tests__/app/admin/users.test.tsx --reporter=verbose

# Run in watch mode during development
npm test -- __tests__/app/admin/ --watch

# Run with coverage to verify all code paths tested
npm run test:coverage -- __tests__/app/admin/
```

---

## References

- [Next.js Testing Documentation](https://nextjs.org/docs/app/guides/testing)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [next-test-api-route-handler](https://www.npmjs.com/package/next-test-api-route-handler)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [vitest-fetch-mock](https://www.npmjs.com/package/vitest-fetch-mock)
- [React 18 StrictMode](https://react.dev/reference/react/StrictMode)
