import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import createFetchMock from 'vitest-fetch-mock';

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
