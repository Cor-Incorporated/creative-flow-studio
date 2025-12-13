/**
 * Canonical host resolution for reverse-proxy environments (e.g., Cloud Run custom domain).
 *
 * - Prefer `x-forwarded-host` when present.
 * - Handle comma-separated values and ports.
 * - Lowercase normalization.
 */

export function getEffectiveHost(headers: Headers): string | null {
    const xfh = headers.get('x-forwarded-host');
    const host = headers.get('host');
    const raw = xfh || host;
    if (!raw) return null;

    // If comma-separated (proxy chain), pick the first entry
    const first = raw.split(',')[0]?.trim();
    if (!first) return null;

    // Strip port
    const withoutPort = first.replace(/:\d+$/, '');
    return withoutPort.toLowerCase();
}

export function shouldRedirectToCanonicalHost(input: {
    headers: Headers;
    canonicalHost: string | undefined;
}): { shouldRedirect: boolean; effectiveHost: string | null; canonicalHost: string | null } {
    const canonicalHost = (input.canonicalHost || '').toLowerCase().trim() || null;
    const effectiveHost = getEffectiveHost(input.headers);

    if (!canonicalHost || !effectiveHost) {
        return { shouldRedirect: false, effectiveHost, canonicalHost };
    }

    if (effectiveHost === canonicalHost) {
        return { shouldRedirect: false, effectiveHost, canonicalHost };
    }

    return { shouldRedirect: true, effectiveHost, canonicalHost };
}


