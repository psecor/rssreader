import { promises as dns } from 'dns';
import net from 'net';
import { URL } from 'url';

const MAX_REDIRECTS = 3;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TIMEOUT_MS = 10_000;
const ALLOWED_SCHEMES = new Set(['http:', 'https:']);
const USER_AGENT = 'rssreader/1.0 (+https://secorp.net/rssreader)';

export class SafeFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SafeFetchError';
  }
}

// Blocks RFC 1918, loopback, link-local, CGNAT, multicast, and IPv6 equivalents.
// Also rejects IPv4-mapped IPv6 addresses whose embedded v4 is private.
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0) return true; // "this network"
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fe80:')) return true; // link-local
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA
    if (normalized.startsWith('::ffff:')) {
      return isPrivateIp(normalized.slice(7));
    }
    return false;
  }
  return true; // unknown format = reject
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new SafeFetchError(`Refusing private IP ${hostname}`);
    }
    return;
  }
  const addresses = await dns.lookup(hostname, { all: true });
  for (const a of addresses) {
    if (isPrivateIp(a.address)) {
      throw new SafeFetchError(
        `Refusing ${hostname}: resolves to private ${a.address}`,
      );
    }
  }
}

// Fetches a URL with SSRF-safe defaults: scheme allowlist, private-IP DNS
// blocklist re-checked at every redirect hop, redirect cap, response-size cap,
// and request timeout.
export async function safeFetchText(rawUrl: string): Promise<string> {
  let currentUrl = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = new URL(currentUrl);
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
      throw new SafeFetchError(`Disallowed scheme ${parsed.protocol}`);
    }
    await assertPublicHost(parsed.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new SafeFetchError(`Redirect ${response.status} without Location`);
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!response.ok) {
      throw new SafeFetchError(`HTTP ${response.status} for ${currentUrl}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new SafeFetchError('Empty response body');
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) {
        controller.abort();
        throw new SafeFetchError(`Response exceeded ${MAX_BYTES} bytes`);
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  throw new SafeFetchError(`Exceeded ${MAX_REDIRECTS} redirects`);
}
