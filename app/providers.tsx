'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';

/**
 * Client-side providers wrapper
 * Wraps the app with NextAuth SessionProvider
 *
 * Reference: https://next-auth.js.org/getting-started/client#sessionprovider
 */
export function Providers({ children }: { children: ReactNode }) {
    return <SessionProvider>{children}</SessionProvider>;
}
