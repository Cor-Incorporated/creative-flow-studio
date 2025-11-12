# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Creative Flow Studio is a multimodal AI SaaS application that integrates multiple Google Gemini AI capabilities into a single chat interface. It supports text generation (chat, pro mode with thinking, search-grounded), image generation/editing (Imagen 4.0), video generation (Veo 3.1), and multimodal interactions. The app features a DJ Shacho Mode that applies a unique persona (high-energy, Kyushu dialect speaking entrepreneur) to text responses.

## Branch Strategy

- **main**: Alpha version (React + Vite frontend-only), deployed to Vercel
- **dev**: Next.js 14 full-stack SaaS (CURRENT DEVELOPMENT BRANCH)

**IMPORTANT:** You are currently working on the `dev` branch. This document describes the Next.js implementation, not the alpha version.

---

## Current Status (dev branch - 2025-11-12)

### What's Been Completed

#### ✅ Phase 2: Environment Setup (COMPLETED)

- Next.js 14 (App Router) project initialized with TypeScript
- Prisma ORM configured with PostgreSQL schema
- Development tools: ESLint, Prettier, Vitest, Playwright
- Tailwind CSS v4 with PostCSS configuration
- Path aliases configured (`@/` → project root)

#### ✅ Phase 3: Authentication Foundation (COMPLETED)

- NextAuth.js 4.24.13 installed with Prisma Adapter
- Google OAuth provider configured
- Server-side session strategy with database persistence
- Environment variable validation in `lib/auth.ts`
- Custom pages removed (will be implemented when needed)

#### ✅ Gemini API Integration (COMPLETED)

**Type System:**

- `types/app.ts`: Complete type definitions for messages, media, content parts
- Zod schemas for API request/response validation
- Role types: 'user' | 'model'
- Generation modes: 'chat' | 'pro' | 'search' | 'image' | 'video'

**API Routes (Server-Side):**

- `/api/gemini/chat` - Chat/Pro/Search modes with conversation history
- `/api/gemini/image` - Image generation and editing (Imagen 4.0)
- `/api/gemini/video` - Video generation (Veo 3.1)
- `/api/gemini/video/status` - Video polling endpoint
- `/api/gemini/video/download` - Secure video proxy (no API key exposure)

**Gemini Service Layer:**

- `lib/gemini.ts`: Server-side wrapper for @google/genai SDK
- All API calls use server-side `GEMINI_API_KEY`
- Correct model IDs: `gemini-2.5-flash`, `gemini-2.5-pro`

#### ✅ UI Components Migration (COMPLETED)

- `components/ChatMessage.tsx`: Message display with image/video/text/sources
- `components/ChatInput.tsx`: Mode selector, DJ Shacho toggle, file upload
- `components/icons.tsx`: SVG icon components
- `app/page.tsx`: Main chat interface with full state management

**Main Features in app/page.tsx:**

- Message history with auto-scroll
- DJ Shacho Mode with dynamic greeting messages
- All 5 generation modes (Chat/Pro/Search/Image/Video)
- Video polling with progress and timeout protection
- Image editing workflow
- Blob URL memory management
- Error handling with DJ Shacho style conversion

#### ✅ Security & Compatibility Fixes (COMPLETED)

- Removed `NEXT_PUBLIC_GEMINI_API_KEY` client-side exposure
- Video downloads now use `/api/gemini/video/download` proxy
- ESLint 9 compatibility with `ignoreDuringBuilds: true`
- Gemini API security guidelines compliant

#### ✅ API Design Documentation (COMPLETED)

- `docs/api-design-conversation.md`: Full conversation persistence API spec
- Defined CRUD endpoints for Conversation and Message
- Authentication/authorization requirements documented
- 3-phase implementation plan outlined

### What's Next (Priority Order)

#### 🔄 Phase 4: Conversation Persistence (CURRENT PHASE)

**Step 1: Validation Schemas**

- [ ] Create `lib/validators.ts` with Zod schemas:
    - `createConversationSchema`
    - `updateConversationSchema`
    - `createMessageSchema`

**Step 2: Phase 1 API Implementation (Minimum Viable)**

- [ ] `POST /api/conversations` - Create new conversation
- [ ] `POST /api/conversations/[id]/messages` - Add message to conversation
- [ ] `GET /api/conversations/[id]` - Get conversation with messages
- [ ] All endpoints require NextAuth session authentication
- [ ] Verify user owns conversation (userId check)

**Step 3: Frontend Integration**

- [ ] Modify `app/page.tsx` to auto-save conversations
- [ ] Load existing conversations on mount (if user authenticated)
- [ ] Create new conversation on first message

**Step 4: Phase 2 API (Management)**

- [ ] `GET /api/conversations` - List user's conversations
- [ ] `PATCH /api/conversations/[id]` - Update title
- [ ] `DELETE /api/conversations/[id]` - Delete conversation

**Step 5: UI Enhancements**

- [ ] Add sidebar with conversation history
- [ ] Implement conversation switching
- [ ] Add "New Conversation" button

#### ⏳ Phase 5: Stripe Integration (FUTURE)

- [ ] Stripe Product/Price sync
- [ ] Checkout session implementation
- [ ] Customer Portal
- [ ] Webhook handlers (`/api/stripe/webhook`)
- [ ] Plan-based usage limits

#### ⏳ Phase 6: Admin Dashboard (FUTURE)

- [ ] `/admin` route with role-based access
- [ ] User management UI
- [ ] Usage monitoring dashboard

---

## Important Technical Decisions

### Security

1. **API Key Handling**: ALL Gemini API calls are server-side only. `GEMINI_API_KEY` is NEVER exposed to client.
2. **Video Downloads**: Use `/api/gemini/video/download` proxy endpoint to avoid client-side API key exposure.
3. **Authentication**: NextAuth.js session required for all conversation APIs.
4. **Authorization**: Users can only access their own conversations (userId check in API routes).

### Architecture Patterns

1. **API Routes are Server-Side Only**: All Gemini API calls happen in `/app/api/*` Route Handlers.
2. **Client Components**: `app/page.tsx`, `ChatMessage`, `ChatInput` use `'use client'` directive.
3. **Type Safety**: Zod schemas validate all API inputs/outputs.
4. **Error Handling**: DJ Shacho Mode can convert errors to persona style.

### Model IDs (CRITICAL)

```typescript
// lib/constants.ts
export const GEMINI_MODELS = {
    FLASH: 'gemini-2.5-flash', // NOT gemini-2.0-flash-exp
    PRO: 'gemini-2.5-pro', // NOT gemini-2.0-flash-thinking-exp-01-21
    FLASH_IMAGE: 'gemini-2.5-flash-image',
    IMAGEN: 'imagen-4.0',
    VEO: 'veo-3.1-fast',
};
```

### ESLint 9 with Next.js 14

- ESLint 9.39.1 installed but not fully compatible with Next.js 14
- `next.config.js` has `eslint.ignoreDuringBuilds: true`
- Run `npm run lint` separately for linting
- Full ESLint 9 support expected in Next.js 15

---

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check

# Testing
npm test              # Vitest
npm run test:e2e      # Playwright

# Prisma
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run migrations (dev)
npm run prisma:studio    # Open Prisma Studio
npm run prisma:push      # Push schema to DB (no migration)
```

---

## Architecture (Next.js 14 App Router)

### Tech Stack

- **Framework**: Next.js 14.2.33 (App Router)
- **Language**: TypeScript 5.9.3
- **Database**: PostgreSQL via Prisma 6.19.0
- **Authentication**: NextAuth.js 4.24.13 + Prisma Adapter
- **AI SDK**: @google/genai 1.29.0
- **Styling**: Tailwind CSS 4.1.17
- **Validation**: Zod 4.1.12
- **Testing**: Vitest 4.0.8 + Playwright 1.56.1

### Environment Variables

**Server-Side Only (NEVER expose to client):**

```bash
# .env.local
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
SUPABASE_SERVICE_ROLE_KEY="..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
GEMINI_API_KEY="..."  # Server-side only!
```

**Client-Side (Public):**

```bash
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_SUPABASE_URL="https://..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
```

**IMPORTANT**: NEVER use `NEXT_PUBLIC_GEMINI_API_KEY`. All Gemini calls are server-side.

### File Structure

```
/
├── app/                           # Next.js App Router
│   ├── page.tsx                   # Main chat interface ('use client')
│   ├── layout.tsx                 # Root layout
│   ├── api/                       # API Routes (server-side)
│   │   ├── auth/[...nextauth]/route.ts  # NextAuth.js
│   │   └── gemini/
│   │       ├── chat/route.ts      # Chat/Pro/Search modes
│   │       ├── image/route.ts     # Image generation/editing
│   │       ├── video/route.ts     # Video generation
│   │       └── video/
│   │           ├── status/route.ts    # Video polling
│   │           └── download/route.ts  # Video proxy (secure)
│   └── (future)
│       ├── conversations/[id]/page.tsx  # Conversation view
│       └── admin/                 # Admin dashboard
├── components/                    # React components
│   ├── ChatMessage.tsx            # Message display
│   ├── ChatInput.tsx              # Input area with controls
│   └── icons.tsx                  # SVG icons
├── lib/                           # Utilities & services
│   ├── auth.ts                    # NextAuth configuration
│   ├── prisma.ts                  # Prisma client singleton
│   ├── gemini.ts                  # Gemini API service wrapper
│   ├── fileUtils.ts               # File/base64 utilities
│   └── constants.ts               # App-wide constants
├── types/                         # TypeScript types
│   └── app.ts                     # Message, Media, ContentPart, etc.
├── prisma/
│   └── schema.prisma              # Database schema
├── docs/
│   ├── implementation-plan.md     # Full SaaS migration plan
│   ├── interface-spec.md          # App ⇔ Infra interface
│   └── api-design-conversation.md # Conversation API spec
├── infra/                         # Terraform IaC
│   └── envs/dev/                  # Dev environment
├── alpha/                         # Old React+Vite app (reference only)
├── public/
│   └── DJ_Shacho_400x400.jpg     # DJ Shacho avatar
├── .env.local                     # Local environment variables (gitignored)
├── next.config.js                 # Next.js configuration
├── tailwind.config.js             # Tailwind CSS configuration
├── postcss.config.js              # PostCSS configuration
└── tsconfig.json                  # TypeScript configuration
```

### Data Models (Prisma)

**User** → **Conversation** → **Message**

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

model Message {
  id             String      @id @default(cuid())
  conversationId String
  role           MessageRole
  content        Json        // ContentPart[] structure
  createdAt      DateTime    @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
}
```

### API Route Pattern

All API routes follow this pattern:

```typescript
// app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        // 1. Authenticate
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Validate input
        const body = await request.json();
        const validated = someZodSchema.parse(body);

        // 3. Authorize (check user owns resource)
        const resource = await prisma.resource.findUnique({
            where: { id: validated.id },
        });
        if (resource.userId !== session.user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 4. Process
        const result = await doSomething(validated);

        // 5. Return
        return NextResponse.json({ result });
    } catch (error: any) {
        console.error('Error in /api/example:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
```

---

## DJ Shacho Mode

Special persona mode that applies DJ Shacho (Shunsuke Kimoto) speaking style to text responses.

**Characteristics:**

- High-energy, enthusiastic tone
- Kyushu dialect (博多弁)
- Positive, motivational messaging
- First-person: 「俺」

**Implementation:**

- Toggle in `ChatInput` component
- `DJ_SHACHO_SYSTEM_PROMPT` passed to text generation APIs
- `DJ_SHACHO_TEMPERATURE = 0.9` for creative responses
- Error messages also converted to DJ Shacho style
- Image/video prompts NOT modified (Gemini policy compliance)
- Initial greeting changes based on mode state

**Files:**

- `lib/constants.ts`: `DJ_SHACHO_SYSTEM_PROMPT`, `DJ_SHACHO_INITIAL_MESSAGE`
- `public/DJ_Shacho_400x400.jpg`: Avatar image
- `app/page.tsx`: `convertToDjShachoStyle()` function

---

## Important Implementation Notes

### Message State Management

```typescript
// app/page.tsx pattern
const [messages, setMessages] = useState<Message[]>([
    {
        id: 'init',
        role: 'model',
        parts: [{ text: 'クリエイティブフロースタジオへようこそ！...' }],
    },
]);

// Add message
const addMessage = (message: Omit<Message, 'id'>) => {
    setMessages(prev => [...prev, { ...message, id: Date.now().toString() }]);
};

// Update last message (for loading/progress)
const updateLastMessage = (updater: (lastMessage: Message) => Message) => {
    setMessages(prev => {
        if (prev.length === 0) return prev;
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = updater(newMessages[newMessages.length - 1]);
        return newMessages;
    });
};
```

### Video Generation Pattern

1. Call `POST /api/gemini/video` → get `operationName`
2. Poll `POST /api/gemini/video/status` with `operationName`
3. Update UI with progress percentage (0-100)
4. When `operation.done`, download via `/api/gemini/video/download?uri=...`
5. Create blob URL and track in `blobUrlsRef` for cleanup

### Image Editing Pattern

1. User hovers on generated image → edit button appears
2. User enters edit prompt
3. Call `POST /api/gemini/image` with `{ prompt, originalImage }`
4. Server uses `gemini-2.5-flash-image` model with IMAGE response modality
5. Return edited image as data URL

### Memory Management

```typescript
// Blob URLs must be cleaned up
const blobUrlsRef = useRef<Set<string>>(new Set());

useEffect(() => {
    return () => {
        blobUrlsRef.current.forEach(url => {
            URL.revokeObjectURL(url);
        });
        blobUrlsRef.current.clear();
    };
}, []);
```

### DJ Shacho Mode Ref Pattern

```typescript
// Avoid race conditions in async operations
const isDjShachoModeRef = useRef(isDjShachoMode);
isDjShachoModeRef.current = isDjShachoMode; // Update immediately during render

// Use in async context
const formatErrorMessage = async (errorMessage: string) => {
    if (isDjShachoModeRef.current) {
        return await convertToDjShachoStyle(errorMessage);
    }
    return errorMessage;
};
```

---

## Google Cloud Platform (GCP) Setup

**Project ID**: `dataanalyticsclinic`
**Primary Region**: `asia-northeast1`
**Cloud Run URL**: `https://creative-flow-studio-dev-667780715339.asia-northeast1.run.app`

### Infrastructure (Terraform)

- **VPC**: `creative-flow-studio-vpc`
- **Cloud SQL**: PostgreSQL instance with Private IP
- **Cloud Run**: Next.js container (auto-scaling 0-5 instances)
- **Artifact Registry**: Docker images storage
- **Secret Manager**: Environment variables
- **Cloud Build**: CI/CD pipeline

### Service Accounts

- `cloud-run-runtime@...`: Cloud Run execution with cloudsql.client, secretmanager.secretAccessor
- `667780715339@cloudbuild.gserviceaccount.com`: Cloud Build with run.admin, artifactregistry.writer
- `terraform@...`: Terraform management

### Terraform State

- Bucket: `gs://dataanalyticsclinic-terraform-state`
- Location: `infra/envs/dev/`
- **IMPORTANT**: Codex manages Terraform, not Claude Code

For detailed GCP setup, see `docs/implementation-plan.md`.

---

## Testing Strategy

### Unit Tests (Vitest)

```bash
npm test
npm run test:coverage
```

### E2E Tests (Playwright)

```bash
npm run test:e2e
npm run test:e2e:ui
```

### Manual Testing Checklist

- [ ] Chat mode with conversation history
- [ ] Pro mode with thinking budget
- [ ] Search mode with grounding sources
- [ ] Image generation (all aspect ratios)
- [ ] Image editing workflow
- [ ] Video generation with polling
- [ ] DJ Shacho Mode (on/off, error messages, initial greeting)
- [ ] File upload (image/video validation)
- [ ] Authentication flow (Google OAuth)
- [ ] Conversation persistence (CRUD operations)

---

## Common Issues & Solutions

### Issue: Build fails with ESLint 9 errors

**Solution**: ESLint is disabled during builds (`next.config.js`). Run `npm run lint` separately.

### Issue: Prisma Client not found

**Solution**: Run `npm run prisma:generate` or `npm run build` (includes generate step).

### Issue: Video download fails

**Solution**: Verify `/api/gemini/video/download` proxy is used, NOT direct URI with client-side API key.

### Issue: NextAuth session is null

**Solution**:

1. Check `.env.local` has all auth variables
2. Verify `NEXTAUTH_URL` matches current URL
3. Check `NEXTAUTH_SECRET` is set
4. Ensure database connection is working

---

## References

- [Next.js 14 Documentation](https://nextjs.org/docs)
- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Zod Validation](https://zod.dev/)

---

## Conversation Summary for Next Session

**Last Updated**: 2025-11-12
**Current Branch**: dev
**Latest Commit**: 40eb622 (fix: Resolve security and compatibility issues)

**What We Just Completed**:

1. ✅ Migrated ChatMessage and ChatInput components to Next.js
2. ✅ Implemented app/page.tsx with full conversation state management
3. ✅ Fixed security issue: Removed NEXT_PUBLIC_GEMINI_API_KEY exposure
4. ✅ Created /api/gemini/video/download proxy endpoint
5. ✅ Fixed ESLint 9 compatibility with Next.js 14
6. ✅ Documented conversation persistence API design

**Next Steps (Start Here Tomorrow)**:

1. **Create `lib/validators.ts`** with Zod schemas for conversation APIs
2. **Implement Phase 1 Conversation APIs**:
    - POST /api/conversations
    - POST /api/conversations/[id]/messages
    - GET /api/conversations/[id]
3. **Integrate with app/page.tsx** for auto-save
4. **Test locally with `npm run dev`**

**Key Files to Work With**:

- `lib/validators.ts` (create next)
- `app/api/conversations/route.ts` (create next)
- `app/api/conversations/[id]/route.ts` (create next)
- `app/api/conversations/[id]/messages/route.ts` (create next)
- `app/page.tsx` (modify for auto-save)

**Remember**:

- All API routes require NextAuth session authentication
- Verify userId matches session.user.id for authorization
- Use Zod schemas to validate request bodies
- Message content is stored as JSON (ContentPart[] structure)
- Follow the API design in `docs/api-design-conversation.md`
