type HeaderGetter = { get(name: string): string | null };

export function normalizeHostname(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const first = raw.split(',')[0]?.trim();
    if (!first) return null;
    // Strip port if present (e.g. "example.com:8080")
    return first.replace(/:\d+$/, '');
}

export function getEffectiveHostname(headers: HeaderGetter, fallbackHostname: string): string {
    // Prefer x-forwarded-host in proxy environments (Cloud Run domain mapping)
    const forwarded = normalizeHostname(headers.get('x-forwarded-host'));
    if (forwarded) return forwarded;

    const host = normalizeHostname(headers.get('host'));
    if (host) return host;

    return fallbackHostname;
}


