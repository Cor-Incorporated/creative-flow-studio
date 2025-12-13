import { describe, it, expect } from 'vitest';
import { getEffectiveHostname, normalizeHostname } from '@/lib/canonicalHost';

describe('canonicalHost', () => {
    it('prefers x-forwarded-host over host', () => {
        const headers = new Headers({
            host: 'internal.run.app',
            'x-forwarded-host': 'blunaai.com',
        });
        expect(getEffectiveHostname(headers, 'fallback.example.com')).toBe('blunaai.com');
    });

    it('handles comma-separated x-forwarded-host', () => {
        const headers = new Headers({
            'x-forwarded-host': 'blunaai.com, internal.run.app',
        });
        expect(getEffectiveHostname(headers, 'fallback.example.com')).toBe('blunaai.com');
    });

    it('strips port', () => {
        const headers = new Headers({
            'x-forwarded-host': 'blunaai.com:443',
        });
        expect(getEffectiveHostname(headers, 'fallback.example.com')).toBe('blunaai.com');
    });

    it('falls back to host header when x-forwarded-host is absent', () => {
        const headers = new Headers({ host: 'example.com' });
        expect(getEffectiveHostname(headers, 'fallback.example.com')).toBe('example.com');
    });

    it('normalizeHostname returns null for empty input', () => {
        expect(normalizeHostname(null)).toBe(null);
        expect(normalizeHostname('')).toBe(null);
    });
});


