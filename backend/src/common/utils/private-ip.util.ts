import { isIP } from 'node:net';

// IPv4 private/reserved ranges that must never be reached from image fetching.
const V4_RANGES: Array<[number, number]> = [
  [0x0a000000, 0xff000000], // 10.0.0.0/8
  [0xac100000, 0xfff00000], // 172.16.0.0/12
  [0xc0a80000, 0xffff0000], // 192.168.0.0/16
  [0x7f000000, 0xff000000], // 127.0.0.0/8
  [0xa9fe0000, 0xffff0000], // 169.254.0.0/16 (link-local, incl. AWS IMDS)
  [0x00000000, 0xff000000], // 0.0.0.0/8
  [0xe0000000, 0xf0000000], // 224.0.0.0/4 (multicast)
  [0xf0000000, 0xf0000000], // 240.0.0.0/4 (reserved)
];

const v4ToInt = (ip: string): number | null => {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const o = Number(p);
    if (!Number.isInteger(o) || o < 0 || o > 255) return null;
    n = ((n << 8) | o) >>> 0;
  }
  return n;
};

const isPrivateV4 = (ip: string): boolean => {
  const n = v4ToInt(ip);
  if (n === null) return true; // unparseable → treat as unsafe
  return V4_RANGES.some(([base, mask]) => (n & mask) === (base & mask));
};

const isPrivateV6 = (ip: string): boolean => {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true; // loopback / unspecified
  if (lower.startsWith('fe80:') || lower.startsWith('fe80::')) return true; // link-local
  // fc00::/7 — unique local
  const first = parseInt(lower.split(':')[0] || '0', 16);
  if ((first & 0xfe00) === 0xfc00) return true;
  // IPv4-mapped ::ffff:a.b.c.d — check the embedded IPv4
  const mapped = lower.match(/^::ffff:([0-9.]+)$/);
  if (mapped) return isPrivateV4(mapped[1]);
  return false;
};

export function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateV4(ip);
  if (kind === 6) return isPrivateV6(ip);
  return true; // not a valid IP literal — treat as unsafe
}
