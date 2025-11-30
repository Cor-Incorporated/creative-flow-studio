# Admin API Design - Creative Flow Studio

**Phase**: 6 (Admin Dashboard)
**Steps**: 2 (Admin API Routes) & 3 (Admin Pages)
**Status**: Design Phase
**Date**: 2025-11-13

---

## Overview

This document defines the Admin API endpoints and UI pages for system administrators to manage users, monitor usage, and oversee subscriptions.

**Prerequisites:**
- ✅ Phase 6 Step 1 RBAC Infrastructure (middleware.ts, app/admin/layout.tsx, app/admin/page.tsx)
- ✅ Existing Prisma models (User, Subscription, UsageLog, AuditLog, etc.)
- ✅ NextAuth session management

---

## Security & Authorization

### RBAC Requirements

**Middleware Protection:**
- ✅ `middleware.ts` already protects all `/admin` routes
- ✅ Redirects unauthenticated users to login
- ✅ Returns 403 if `role !== 'ADMIN'`

**API Route Protection (Defense in Depth):**
```typescript
// Every Admin API route must verify ADMIN role
const session = await getServerSession(authOptions);
if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Check role from database (middleware already checked JWT, but double-check)
const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
});

if (user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
}
```

### Audit Logging

All Admin API actions should be logged to `AuditLog`:
```typescript
await prisma.auditLog.create({
    data: {
        userId: session.user.id,
        action: 'admin.users.list', // or 'admin.users.update', etc.
        resource: 'User',
        metadata: { filters, params },
        ipAddress: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent'),
    },
});
```

---

## Phase 6 Step 2: Admin API Routes

### 1. GET /api/admin/users

**Purpose:** List all users with subscription and usage statistics

**Query Parameters:**
- `limit` (number, optional): Max 100, default 20
- `offset` (number, optional): Pagination offset, default 0
- `search` (string, optional): Search by email or name
- `role` (Role, optional): Filter by role (USER, PRO, ENTERPRISE, ADMIN)
- `plan` (string, optional): Filter by plan name (FREE, PRO, ENTERPRISE)
- `status` (SubscriptionStatus, optional): Filter by subscription status

**Response:**
```typescript
{
    users: [
        {
            id: string,
            email: string,
            name: string | null,
            role: Role,
            createdAt: string,
            subscription: {
                planName: string,
                status: SubscriptionStatus,
                currentPeriodEnd: string | null,
            } | null,
            usageStats: {
                totalRequests: number,
                currentMonthRequests: number,
            },
            lastActiveAt: string | null, // Most recent UsageLog createdAt
        },
    ],
    total: number,
    limit: number,
    offset: number,
}
```

**Implementation:**
```typescript
// app/api/admin/users/route.ts
export async function GET(request: NextRequest) {
    // 1. Auth + ADMIN role check
    // 2. Parse query params
    // 3. Build Prisma query with filters
    const users = await prisma.user.findMany({
        where: {
            ...(search && {
                OR: [
                    { email: { contains: search, mode: 'insensitive' } },
                    { name: { contains: search, mode: 'insensitive' } },
                ],
            }),
            ...(role && { role }),
        },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            subscription: {
                select: {
                    plan: { select: { name: true } },
                    status: true,
                    currentPeriodEnd: true,
                },
            },
            _count: { select: { usageLogs: true } },
            usageLogs: {
                where: {
                    createdAt: {
                        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                    },
                },
                select: { id: true },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100),
        skip: offset,
    });

    // 4. Get most recent activity
    // 5. Format response
    // 6. Log to AuditLog
}
```

**Error Responses:**
- `401`: Unauthorized (no session)
- `403`: Forbidden (not ADMIN)
- `400`: Invalid query parameters
- `500`: Internal server error

---

### 2. GET /api/admin/usage

**Purpose:** Retrieve usage logs with filtering and pagination

**Query Parameters:**
- `limit` (number, optional): Max 100, default 50
- `offset` (number, optional): Pagination offset
- `userId` (string, optional): Filter by user ID
- `action` (string, optional): Filter by action type (chat, image_generation, etc.)
- `resourceType` (string, optional): Filter by resource (gemini-2.5-flash, imagen-4.0, etc.)
- `startDate` (ISO string, optional): Filter logs after this date
- `endDate` (ISO string, optional): Filter logs before this date

**Response:**
```typescript
{
    logs: [
        {
            id: string,
            userId: string,
            userEmail: string,
            action: string,
            resourceType: string | null,
            metadata: Json | null,
            createdAt: string,
        },
    ],
    total: number,
    limit: number,
    offset: number,
}
```

**Implementation:**
```typescript
// app/api/admin/usage/route.ts
export async function GET(request: NextRequest) {
    // 1. Auth + ADMIN role check
    // 2. Parse query params
    // 3. Build Prisma query
    const logs = await prisma.usageLog.findMany({
        where: {
            ...(userId && { userId }),
            ...(action && { action }),
            ...(resourceType && { resourceType }),
            ...(startDate || endDate
                ? {
                      createdAt: {
                          ...(startDate && { gte: new Date(startDate) }),
                          ...(endDate && { lte: new Date(endDate) }),
                      },
                  }
                : {}),
        },
        include: {
            user: { select: { email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100),
        skip: offset,
    });

    // 4. Format response
    // 5. Log to AuditLog
}
```

---

### 3. PATCH /api/admin/users/[id]

**Purpose:** Update user role (e.g., promote to ADMIN)

**Request Body:**
```typescript
{
    role: Role, // USER | PRO | ENTERPRISE | ADMIN
}
```

**Response:**
```typescript
{
    user: {
        id: string,
        email: string,
        role: Role,
        updatedAt: string,
    },
}
```

**Implementation:**
```typescript
// app/api/admin/users/[id]/route.ts
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    // 1. Auth + ADMIN role check
    // 2. Validate request body (Zod)
    const body = await request.json();
    const { role } = updateUserRoleSchema.parse(body);

    // 3. Check if target user exists
    const targetUser = await prisma.user.findUnique({
        where: { id: params.id },
    });
    if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 4. Update user role
    const updatedUser = await prisma.user.update({
        where: { id: params.id },
        data: { role },
        select: { id: true, email: true, role: true, updatedAt: true },
    });

    // 5. Log to AuditLog
    await prisma.auditLog.create({
        data: {
            userId: session.user.id,
            action: 'admin.users.update_role',
            resource: `User:${params.id}`,
            metadata: { previousRole: targetUser.role, newRole: role },
        },
    });

    // 6. Return response
}
```

**Error Responses:**
- `401`: Unauthorized
- `403`: Forbidden
- `404`: User not found
- `400`: Invalid role value
- `500`: Internal server error

---

### 4. GET /api/admin/stats

**Purpose:** Get detailed system statistics

**Response:**
```typescript
{
    users: {
        total: number,
        byRole: Record<Role, number>,
        newThisMonth: number,
    },
    subscriptions: {
        active: number,
        byPlan: Record<string, number>, // Plan name -> count
        churnRate: number, // % canceled this month
    },
    usage: {
        totalRequests: number,
        requestsThisMonth: number,
        byAction: Record<string, number>,
        byResourceType: Record<string, number>,
    },
    conversations: {
        total: number,
        averageMessagesPerConversation: number,
    },
    revenue: {
        monthlyRecurringRevenue: number, // in cents
        totalRevenue: number, // sum of PaymentEvent.amount where status=success
    },
}
```

**Implementation:**
```typescript
// app/api/admin/stats/route.ts
export async function GET(request: NextRequest) {
    // 1. Auth + ADMIN role check
    // 2. Run parallel Prisma queries
    const [
        totalUsers,
        usersByRole,
        newUsersThisMonth,
        activeSubscriptions,
        subscriptionsByPlan,
        totalUsageLogs,
        usageLogsThisMonth,
        totalConversations,
        totalMessages,
        totalRevenue,
    ] = await Promise.all([
        prisma.user.count(),
        prisma.user.groupBy({ by: ['role'], _count: true }),
        prisma.user.count({
            where: {
                createdAt: {
                    gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                },
            },
        }),
        // ... (continue with other queries)
    ]);

    // 3. Calculate derived metrics
    // 4. Format response
    // 5. Log to AuditLog
}
```

---

## Zod Validators

**New validators to add to `lib/validators.ts`:**

```typescript
import { z } from 'zod';

// PATCH /api/admin/users/[id]
export const updateUserRoleSchema = z.object({
    role: z.enum(['USER', 'PRO', 'ENTERPRISE', 'ADMIN']),
});

// GET /api/admin/users query params
export const adminUsersQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
    search: z.string().max(100).optional(),
    role: z.enum(['USER', 'PRO', 'ENTERPRISE', 'ADMIN']).optional(),
    plan: z.string().max(50).optional(),
    status: z
        .enum(['ACTIVE', 'INACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'UNPAID'])
        .optional(),
});

// GET /api/admin/usage query params
export const adminUsageQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
    userId: z.string().cuid().optional(),
    action: z.string().max(50).optional(),
    resourceType: z.string().max(50).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
});
```

---

## Phase 6 Step 3: Admin Pages

### 1. /admin/users

**Component:** `app/admin/users/page.tsx`

**Features:**
- Table with columns: Email, Name, Role, Plan, Status, Last Active, Actions
- Search bar (email/name)
- Filters: Role, Plan, Status (dropdowns)
- Pagination controls (prev/next, page size selector)
- "Update Role" button per row (opens modal)
- Link to user's conversations

**UI Libraries:**
- Tailwind CSS for styling
- Headless UI for modals/dropdowns (optional)

**State Management:**
```typescript
const [users, setUsers] = useState<AdminUser[]>([]);
const [total, setTotal] = useState(0);
const [filters, setFilters] = useState({
    search: '',
    role: undefined,
    plan: undefined,
    status: undefined,
    limit: 20,
    offset: 0,
});
```

---

### 2. /admin/usage

**Component:** `app/admin/usage/page.tsx`

**Features:**
- Table with columns: Date/Time, User, Action, Resource Type, Metadata
- Filters: User (autocomplete), Action, Resource Type, Date Range
- Pagination controls
- Export to CSV button (optional)
- Chart visualization (requests over time) using Chart.js or Recharts

**Data Fetching:**
```typescript
useEffect(() => {
    fetch(`/api/admin/usage?${new URLSearchParams(filters)}`)
        .then(res => res.json())
        .then(data => {
            setLogs(data.logs);
            setTotal(data.total);
        });
}, [filters]);
```

---

### 3. /admin/subscriptions (Optional Enhancement)

**Component:** `app/admin/subscriptions/page.tsx`

**Features:**
- Table with columns: User, Plan, Status, Start Date, End Date, MRR
- Filters: Plan, Status
- Summary cards: Total MRR, Active Subscriptions, Churn Rate
- Link to Stripe Customer Portal (external)

---

## Testing Strategy

### Unit Tests (Vitest)

**Test Files:**
- `__tests__/api/admin/users.test.ts` (GET, filtering, pagination)
- `__tests__/api/admin/usage.test.ts` (GET, date range filtering)
- `__tests__/api/admin/users-update.test.ts` (PATCH role update)
- `__tests__/api/admin/stats.test.ts` (GET system stats)

**Test Coverage:**
- ✅ 401 for unauthenticated requests
- ✅ 403 for non-ADMIN users
- ✅ 200 with correct data for ADMIN
- ✅ Query parameter validation (limit, offset, filters)
- ✅ AuditLog creation for all actions

**Example Test:**
```typescript
describe('GET /api/admin/users', () => {
    it('should return 403 for non-ADMIN user', async () => {
        vi.mocked(getServerSession).mockResolvedValue({
            user: { id: 'user_123', email: 'user@example.com' },
        });
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: 'user_123',
            role: 'USER', // Not ADMIN
        });

        const response = await fetch('/api/admin/users');

        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({
            error: 'Forbidden: Admin access required',
        });
    });

    it('should return users list for ADMIN', async () => {
        vi.mocked(getServerSession).mockResolvedValue({
            user: { id: 'admin_123', email: 'admin@example.com' },
        });
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: 'admin_123',
            role: 'ADMIN',
        });
        vi.mocked(prisma.user.findMany).mockResolvedValue([
            {
                id: 'user_1',
                email: 'user1@example.com',
                name: 'User One',
                role: 'USER',
                createdAt: new Date(),
                subscription: {
                    plan: { name: 'FREE' },
                    status: 'ACTIVE',
                    currentPeriodEnd: new Date(),
                },
                _count: { usageLogs: 50 },
                usageLogs: new Array(10).fill({ id: 'log' }),
            },
        ]);
        vi.mocked(prisma.user.count).mockResolvedValue(1);

        const response = await fetch('/api/admin/users?limit=20&offset=0');
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.users).toHaveLength(1);
        expect(data.total).toBe(1);
    });
});
```

---

## Implementation Checklist

### Step 2: Admin API Routes

- [ ] Add Zod validators to `lib/validators.ts`
- [ ] Implement `GET /api/admin/users` with filtering and pagination
- [ ] Implement `GET /api/admin/usage` with date range filtering
- [ ] Implement `PATCH /api/admin/users/[id]` for role updates
- [ ] Implement `GET /api/admin/stats` for system metrics
- [ ] Add AuditLog creation to all Admin APIs
- [ ] Write Vitest tests for all endpoints (target: 20+ tests)
- [ ] Verify type-check passes
- [ ] Verify all tests pass

### Step 3: Admin Pages

- [ ] Create `app/admin/users/page.tsx` with table and filters
- [ ] Create `app/admin/usage/page.tsx` with logs and charts
- [ ] (Optional) Create `app/admin/subscriptions/page.tsx`
- [ ] Add loading states and error handling
- [ ] Implement role update modal in users page
- [ ] Add pagination controls
- [ ] Test mobile responsiveness

---

## Security Considerations

1. **Double-Check Role:** Even though middleware protects routes, verify role in API Routes
2. **Audit Logging:** Log all admin actions to AuditLog for compliance
3. **Rate Limiting:** Consider adding rate limits to prevent admin API abuse
4. **Data Sanitization:** Validate and sanitize all user inputs
5. **Minimal Data Exposure:** Only return necessary data in API responses

---

## Performance Considerations

1. **Pagination:** Enforce max limits (100) to prevent large result sets
2. **Indexes:** Prisma schema already has indexes on `userId, createdAt` for UsageLog
3. **Parallel Queries:** Use `Promise.all()` for independent queries in `/api/admin/stats`
4. **Caching:** Consider caching stats for 5-10 minutes (optional)

---

## Next Steps

1. Review this design with Cursor/Codex for approval
2. Implement Admin API routes (Step 2)
3. Write comprehensive tests
4. Implement Admin UI pages (Step 3)
5. Manual testing with ADMIN role user
6. Update CLAUDE.md with completion status

---

## References

- [Next.js 14 Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Prisma Filtering and Pagination](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)
- [NextAuth.js Session](https://next-auth.js.org/getting-started/client#usesession)
- [Zod Validation](https://zod.dev/)
