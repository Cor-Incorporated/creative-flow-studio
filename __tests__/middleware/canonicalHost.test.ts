import { describe, expect, it } from 'vitest';
import { getEffectiveHostname, normalizeHostname } from '@/lib/canonicalHost';

describe('canonicalHost helpers', () => {
    it('normalizeHostname: strips port and takes first value', () => {
        expect(normalizeHostname('blunaai.com:8080')).toBe('blunaai.com');
        expect(normalizeHostname('blunaai.com, proxy.local')).toBe('blunaai.com');
        expect(normalizeHostname('   blunaai.com   ')).toBe('blunaai.com');
    });

    it('getEffectiveHostname: prefers x-forwarded-host', () => {
        const headers = new Headers({
            'x-forwarded-host': 'blunaai.com',
            host: 'creative-flow-studio-dev-00000.run.app',
        });
        expect(getEffectiveHostname(headers, 'fallback.example')).toBe('blunaai.com');
    });

    it('getEffectiveHostname: falls back to host', () => {
        const headers = new Headers({
            host: 'blunaai.com:8080',
        });
        expect(getEffectiveHostname(headers, 'fallback.example')).toBe('blunaai.com');
    });

    it('getEffectiveHostname: falls back to request hostname if headers missing', () => {
        const headers = new Headers({});
        expect(getEffectiveHostname(headers, 'fallback.example')).toBe('fallback.example');
    });
});


