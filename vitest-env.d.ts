/// <reference types="vitest" />
/// <reference types="@testing-library/jest-dom" />

import type { FetchMock } from 'vitest-fetch-mock';

type FetchMockInstance = FetchMock & ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>);

declare global {
    // Vitest replaces the global fetch with a FetchMock instance during tests
    // so we widen the type to include mock helper methods (mockResponse, mockAbort, etc.).
    // This declaration is limited to the Vitest environment via tsconfig include ordering.
    var fetch: FetchMockInstance;
}

export {};
