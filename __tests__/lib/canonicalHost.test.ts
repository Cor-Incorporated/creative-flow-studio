import { describe, it, expect } from 'vitest';
import { getEffectiveHost, shouldRedirectToCanonicalHost } from '@/lib/canonicalHost';

describe('canonicalHost', () => {
    it('prefers x-forwarded-host over host', () => {
        const headers = new Headers({
            host: 'internal.run.app',
            'x-forwarded-host': 'blunaai.com',
        });
        expect(getEffectiveHost(headers)).toBe('blunaai.com');
    });

    it('handles comma-separated x-forwarded-host', () => {
        const headers = new Headers({
            'x-forwarded-host': 'blunaai.com, internal.run.app',
        });
        expect(getEffectiveHost(headers)).toBe('blunaai.com');
    });

    it('strips port', () => {
        const headers = new Headers({
            'x-forwarded-host': 'blunaai.com:443',
        });
        expect(getEffectiveHost(headers)).toBe('blunaai.com');
    });

    it('returns shouldRedirect=true when effectiveHost differs from canonical', () => {
        const headers = new Headers({ host: 'creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app' });
        const res = shouldRedirectToCanonicalHost({ headers, canonicalHost: 'blunaai.com' });
        expect(res.shouldRedirect).toBe(true);
        expect(res.canonicalHost).toBe('blunaai.com');
    });

    it('returns shouldRedirect=false when canonical host is not set', () => {
        const headers = new Headers({ host: 'example.com' });
        const res = shouldRedirectToCanonicalHost({ headers, canonicalHost: undefined });
        expect(res.shouldRedirect).toBe(false);
    });
});


