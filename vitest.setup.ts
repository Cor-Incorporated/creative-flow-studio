import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import createFetchMock from 'vitest-fetch-mock';

// ---- Global mocks (stabilize NextAuth in unit tests) ----
// Some environments restrict filesystem access patterns used by jose/next-auth internals.
// We mock NextAuth modules globally so API route tests don't load jose at import-time.
vi.mock('next-auth', () => ({
    getServerSession: vi.fn(),
}));
vi.mock('next-auth/jwt', () => ({
    getToken: vi.fn(),
}));
vi.mock('@next-auth/prisma-adapter', () => ({
    PrismaAdapter: () => ({}),
}));
vi.mock('next-auth/providers/google', () => ({
    default: () => ({ id: 'google', name: 'Google', type: 'oauth' }),
}));
vi.mock('next-auth/providers/credentials', () => ({
    default: () => ({ id: 'credentials', name: 'Credentials', type: 'credentials' }),
}));

// Initialize vitest-fetch-mock for Happy-DOM
const fetchMocker = createFetchMock(vi);

// Enable mocks globally
fetchMocker.enableMocks();

// CRITICAL: Doable mock - replaces Happy-DOM's fetch implementation
fetchMocker.doMock();

// Reset fetch mocks before each test
beforeEach(() => {
    fetchMocker.resetMocks();
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
