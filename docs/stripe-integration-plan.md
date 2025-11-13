# Stripe Integration Plan

## 概要

Creative Flow StudioにStripe決済を統合し、サブスクリプションベースの課金システムを実装します。

**実装根拠:**
- [Stripe Checkout Documentation](https://docs.stripe.com/payments/checkout)
- [Stripe Billing Subscriptions](https://docs.stripe.com/billing/subscriptions/build-subscriptions)
- [Stripe Webhooks for Subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Next.js Stripe Integration (2025)](https://medium.com/@gragson.john/stripe-checkout-and-webhook-in-a-next-js-15-2025-925d7529855e)

---

## データモデル (既存Prisma Schema)

### Plan
```prisma
model Plan {
    id                  String   @id @default(cuid())
    name                String   @unique
    stripePriceId       String?  @unique
    monthlyPrice        Int // in cents
    features            Json
    maxRequestsPerMonth Int?
    maxFileSize         Int?
    createdAt           DateTime @default(now())
    updatedAt           DateTime @updatedAt
    subscriptions       Subscription[]
}
```

### Subscription
```prisma
model Subscription {
    id                   String             @id @default(cuid())
    userId               String             @unique
    planId               String
    stripeCustomerId     String?            @unique
    stripeSubscriptionId String?            @unique
    status               SubscriptionStatus @default(INACTIVE)
    currentPeriodStart   DateTime?
    currentPeriodEnd     DateTime?
    cancelAtPeriodEnd    Boolean            @default(false)
    createdAt            DateTime           @default(now())
    updatedAt            DateTime           @updatedAt

    user          User           @relation(...)
    plan          Plan           @relation(...)
    paymentEvents PaymentEvent[]
}

enum SubscriptionStatus {
    ACTIVE
    INACTIVE
    TRIALING
    PAST_DUE
    CANCELED
    UNPAID
}
```

### PaymentEvent
```prisma
model PaymentEvent {
    id             String   @id @default(cuid())
    subscriptionId String
    stripeEventId  String   @unique
    type           String
    amount         Int?
    status         String?
    metadata       Json?
    createdAt      DateTime @default(now())

    subscription Subscription @relation(...)
}
```

---

## Phase 1: Checkout Session実装

### 1.1 API Route: Create Checkout Session

**Endpoint:** `POST /api/stripe/checkout`

**認証:** NextAuth session required

**Request Body:**
```typescript
{
    priceId: string  // Stripe Price ID (e.g., 'price_...')
    successUrl?: string  // Optional custom success URL
    cancelUrl?: string   // Optional custom cancel URL
}
```

**処理フロー:**
1. NextAuth session確認
2. Prisma で既存Subscription確認
3. Stripe Customer作成 or 取得
4. Checkout Session作成
   ```typescript
   const session = await stripe.checkout.sessions.create({
       customer: stripeCustomerId,
       mode: 'subscription',
       payment_method_types: ['card'],
       line_items: [{
           price: priceId,
           quantity: 1,
       }],
       success_url: `${APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
       cancel_url: `${APP_URL}/pricing`,
       metadata: {
           userId: session.user.id,
       },
   });
   ```
5. Session URL返却

**Response:**
```typescript
{
    sessionId: string
    url: string  // Redirect URL to Stripe Checkout
}
```

**公式参考:** [Create Checkout Session](https://docs.stripe.com/api/checkout/sessions/create)

---

### 1.2 UI Component: Pricing Page

**Path:** `app/pricing/page.tsx`

**要件:**
- 3プラン表示 (FREE, PRO, ENTERPRISE)
- "Subscribe" ボタン → Checkout Session作成 → Stripe Checkout へリダイレクト
- 現在のプラン表示 (認証済みユーザー)
- プラン比較テーブル

**実装例:**
```typescript
const handleSubscribe = async (priceId: string) => {
    const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
    });

    const { url } = await response.json();
    window.location.href = url;  // Redirect to Stripe
};
```

---

### 1.3 Success/Cancel Pages

**Success Page:** `app/dashboard/page.tsx?session_id={CHECKOUT_SESSION_ID}`
- Checkout Session IDを検証
- 確認メッセージ表示
- ダッシュボードへ誘導

**Cancel Page:** `app/pricing/page.tsx`
- キャンセル通知表示
- 再度購入可能

---

## Phase 2: Webhook Handler実装

### 2.1 API Route: Stripe Webhook

**Endpoint:** `POST /api/stripe/webhook`

**認証:** Stripe署名検証のみ (NextAuth不要)

**処理フロー:**
```typescript
import Stripe from 'stripe';
import { headers } from 'next/headers';

export async function POST(request: Request) {
    const body = await request.text();
    const signature = headers().get('stripe-signature')!;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err: any) {
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // Event handling
    switch (event.type) {
        case 'checkout.session.completed':
            await handleCheckoutSessionCompleted(event.data.object);
            break;
        case 'invoice.paid':
            await handleInvoicePaid(event.data.object);
            break;
        case 'invoice.payment_failed':
            await handleInvoicePaymentFailed(event.data.object);
            break;
        case 'customer.subscription.updated':
            await handleSubscriptionUpdated(event.data.object);
            break;
        case 'customer.subscription.deleted':
            await handleSubscriptionDeleted(event.data.object);
            break;
    }

    return new Response(JSON.stringify({ received: true }));
}
```

**公式参考:** [Stripe Webhooks](https://docs.stripe.com/webhooks)

---

### 2.2 Webhook Event Handlers

#### checkout.session.completed
```typescript
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const { metadata, customer, subscription } = session;
    const userId = metadata?.userId;

    if (!userId || !customer || !subscription) return;

    // Subscription作成 or 更新
    await prisma.subscription.upsert({
        where: { userId },
        update: {
            stripeCustomerId: customer as string,
            stripeSubscriptionId: subscription as string,
            status: 'ACTIVE',
        },
        create: {
            userId,
            planId: await getPlanIdFromStripeSubscription(subscription as string),
            stripeCustomerId: customer as string,
            stripeSubscriptionId: subscription as string,
            status: 'ACTIVE',
        },
    });

    // PaymentEvent記録
    await prisma.paymentEvent.create({
        data: {
            subscriptionId: subscription.id,
            stripeEventId: session.id,
            type: 'checkout.session.completed',
            amount: session.amount_total,
            status: 'succeeded',
        },
    });
}
```

#### invoice.paid
```typescript
async function handleInvoicePaid(invoice: Stripe.Invoice) {
    const subscriptionId = invoice.subscription as string;

    // Subscription更新
    await prisma.subscription.update({
        where: { stripeSubscriptionId: subscriptionId },
        data: {
            status: 'ACTIVE',
            currentPeriodStart: new Date(invoice.period_start * 1000),
            currentPeriodEnd: new Date(invoice.period_end * 1000),
        },
    });

    // PaymentEvent記録
    await prisma.paymentEvent.create({
        data: {
            subscriptionId,
            stripeEventId: invoice.id,
            type: 'invoice.paid',
            amount: invoice.amount_paid,
            status: 'paid',
            metadata: {
                billing_reason: invoice.billing_reason,
            },
        },
    });
}
```

**公式参考:** [Using Webhooks with Subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks)

---

## Phase 3: Subscription Management UI

### 3.1 Dashboard Page

**Path:** `app/dashboard/page.tsx`

**表示内容:**
- 現在のプラン名
- 次回請求日 (`currentPeriodEnd`)
- 使用状況 (API呼び出し数 / 上限)
- "プラン変更" ボタン
- "キャンセル" ボタン

---

### 3.2 API Route: Customer Portal Session

**Endpoint:** `POST /api/stripe/portal`

**認証:** NextAuth session required

**処理:**
```typescript
const session = await stripe.billingPortal.sessions.create({
    customer: user.subscription.stripeCustomerId,
    return_url: `${APP_URL}/dashboard`,
});

return Response.json({ url: session.url });
```

**機能:**
- プラン変更
- 支払い方法更新
- 請求履歴表示
- サブスクリプションキャンセル

**公式参考:** [Customer Portal](https://docs.stripe.com/billing/subscriptions/integrating-customer-portal)

---

### 3.3 API Route: Change Plan

**Endpoint:** `PATCH /api/stripe/subscription`

**認証:** NextAuth session required

**Request Body:**
```typescript
{
    newPriceId: string
}
```

**処理:**
```typescript
const subscription = await stripe.subscriptions.retrieve(
    user.subscription.stripeSubscriptionId
);

await stripe.subscriptions.update(subscription.id, {
    items: [{
        id: subscription.items.data[0].id,
        price: newPriceId,
    }],
    proration_behavior: 'always_invoice',  // Immediate proration
});
```

**公式参考:** [Update Subscription](https://docs.stripe.com/api/subscriptions/update)

---

## Phase 4: Usage-Based Limits

### 4.1 Middleware: Check Subscription

**Path:** `lib/subscription.ts`

```typescript
export async function checkSubscriptionLimits(userId: string, action: string) {
    const subscription = await prisma.subscription.findUnique({
        where: { userId },
        include: { plan: true },
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
        throw new Error('Active subscription required');
    }

    const plan = subscription.plan;
    const features = plan.features as PlanFeatures;

    // Check action-specific limits
    switch (action) {
        case 'image_generation':
            if (!features.allowImageGeneration) {
                throw new Error('Image generation not allowed in current plan');
            }
            break;
        case 'video_generation':
            if (!features.allowVideoGeneration) {
                throw new Error('Video generation not allowed in current plan');
            }
            break;
        case 'pro_mode':
            if (!features.allowProMode) {
                throw new Error('Pro mode not allowed in current plan');
            }
            break;
    }

    // Check monthly usage
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const usageCount = await prisma.usageLog.count({
        where: {
            userId,
            createdAt: { gte: currentMonth },
        },
    });

    if (features.maxRequestsPerMonth && usageCount >= features.maxRequestsPerMonth) {
        throw new Error('Monthly request limit exceeded');
    }

    return { allowed: true, plan, usageCount };
}
```

---

### 4.2 Integration with Gemini API Routes

**Example:** `app/api/gemini/video/route.ts`

```typescript
export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check subscription limits
    try {
        await checkSubscriptionLimits(session.user.id, 'video_generation');
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 403 });
    }

    // Proceed with video generation...
}
```

---

## Security Considerations

### 1. Webhook Signature Verification
- **MUST** verify `stripe-signature` header
- Use `stripe.webhooks.constructEvent()`
- Invalid signatures → 400 Bad Request

### 2. Idempotency
- Check `stripeEventId` uniqueness in `PaymentEvent`
- Prevent duplicate webhook processing

### 3. Environment Variables
```bash
# Server-side only (NEVER expose to client)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Client-side (Public)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## Testing Strategy

### 1. Stripe CLI Webhooks
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger checkout.session.completed
stripe trigger invoice.paid
```

### 2. Test Mode
- Use `sk_test_...` keys for development
- Create test subscriptions via Stripe Dashboard
- Verify webhook handling in logs

### 3. Integration Tests
```typescript
// __tests__/api/stripe/webhook.test.ts
describe('POST /api/stripe/webhook', () => {
    it('should handle checkout.session.completed', async () => {
        const event = stripe.webhooks.generateTestHeaderString({
            payload: mockCheckoutSession,
            secret: WEBHOOK_SECRET,
        });

        const response = await fetch('/api/stripe/webhook', {
            method: 'POST',
            headers: { 'stripe-signature': event },
            body: JSON.stringify(mockCheckoutSession),
        });

        expect(response.status).toBe(200);
        // Verify subscription created in DB
    });
});
```

---

## Implementation Order

1. ✅ **Phase 0**: Prisma schema (既に完了)
2. **Phase 1**: Checkout Session (1-2 days)
   - POST /api/stripe/checkout
   - app/pricing/page.tsx
   - Success/Cancel pages
3. **Phase 2**: Webhook Handler (2-3 days)
   - POST /api/stripe/webhook
   - Event handlers (checkout.session.completed, invoice.*, customer.subscription.*)
   - PaymentEvent logging
4. **Phase 3**: Subscription Management (2-3 days)
   - app/dashboard/page.tsx
   - POST /api/stripe/portal
   - PATCH /api/stripe/subscription
5. **Phase 4**: Usage Limits (1-2 days)
   - lib/subscription.ts
   - Integration with Gemini API routes
   - UsageLog tracking

**Total Estimate:** 6-10 days

---

## References

- [Stripe Checkout Documentation](https://docs.stripe.com/payments/checkout)
- [Stripe Subscriptions Overview](https://docs.stripe.com/billing/subscriptions/overview)
- [Stripe Webhooks Documentation](https://docs.stripe.com/webhooks)
- [Next.js Stripe Integration Guide (2025)](https://medium.com/@gragson.john/stripe-checkout-and-webhook-in-a-next-js-15-2025-925d7529855e)
- [Stripe Customer Portal](https://docs.stripe.com/billing/subscriptions/integrating-customer-portal)
- [Stripe API Reference](https://docs.stripe.com/api)
