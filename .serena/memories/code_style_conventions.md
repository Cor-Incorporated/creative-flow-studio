# Code Style & Conventions

## TypeScript Configuration

- **Target**: ES2022
- **Module**: ESNext with bundler resolution
- **Strict mode**: Enabled
- **Path aliases**: `@/*` maps to project root
- **JSX**: preserve (handled by Next.js)

## Prettier Configuration

- **Semicolons**: Required (`semi: true`)
- **Quotes**: Single quotes (`singleQuote: true`)
- **Trailing commas**: ES5 style (`trailingComma: "es5"`)
- **Print width**: 100 characters
- **Tab width**: 4 spaces (NO tabs)
- **Arrow parens**: Avoid when possible (`arrowParens: "avoid"`)
- **Line endings**: LF (Unix style)

## ESLint Rules

- **Base**: Next.js core-web-vitals + TypeScript
- **Prettier integration**: `prettier/prettier` as error
- **Indentation**: 4 spaces, SwitchCase: 1
- **Quotes**: Single quotes with escape avoidance
- **Semicolons**: Always required
- **Unused vars**: Warn (ignore if prefixed with `_`)

## Naming Conventions

### Files
- Components: PascalCase (e.g., `ChatMessage.tsx`)
- Utilities: camelCase (e.g., `fileUtils.ts`)
- API routes: lowercase with hyphens (e.g., `[...nextauth]`)
- Types: camelCase (e.g., `app.ts`)

### Variables & Functions
- Variables: camelCase (e.g., `isDjShachoMode`)
- Functions: camelCase (e.g., `convertToDjShachoStyle`)
- Constants: UPPER_SNAKE_CASE (e.g., `GEMINI_API_KEY`)
- Types/Interfaces: PascalCase (e.g., `Message`, `ContentPart`)

### Components
- React components: PascalCase (e.g., `ChatInput`)
- Props interfaces: PascalCase with `Props` suffix (e.g., `ChatInputProps`)
- Use named exports for components

## Code Organization

### Component Structure
```typescript
'use client'; // If client component

import { ... } from 'react';
import { ... } from 'next/...';
import { ... } from '@/lib/...';
import { ... } from '@/types/...';

interface ComponentProps {
    // Props definition
}

export function ComponentName({ props }: ComponentProps) {
    // 1. Hooks
    // 2. Refs
    // 3. State
    // 4. Effects
    // 5. Handlers
    // 6. Render helpers
    // 7. JSX
}
```

### API Route Structure
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        // 1. Authentication check
        // 2. Input validation (Zod)
        // 3. Authorization check (userId)
        // 4. Business logic
        // 5. Return response
    } catch (error: any) {
        console.error('Error in /api/...:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
```

## Import Order

1. React & Next.js imports
2. External libraries
3. Internal utilities (`@/lib/...`)
4. Types (`@/types/...`)
5. Components (`@/components/...`)
6. Relative imports

## Comments & Documentation

- Use JSDoc comments for exported functions
- Explain WHY, not WHAT (code should be self-documenting)
- Add comments for complex business logic
- Document API endpoints with request/response examples

## Best Practices

### Security
- NEVER expose API keys to client (`NEXT_PUBLIC_GEMINI_API_KEY` is forbidden)
- Always validate user input with Zod schemas
- Check userId ownership before data access
- Use `getServerSession()` for authentication

### Performance
- Use `useRef` to avoid race conditions with async state
- Clean up blob URLs in useEffect cleanup
- Implement auto-scroll for chat messages
- Use parallel API calls when possible

### Error Handling
- Always wrap API calls in try-catch
- Log errors with context information
- Return user-friendly error messages
- Convert errors to DJ Shacho style when mode is active

### State Management
- Keep state close to where it's used
- Use updater functions for state depending on previous state
- Avoid prop drilling (consider Context for deeply nested data)
