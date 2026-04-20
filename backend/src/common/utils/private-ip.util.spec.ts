import { describe, it, expect } from 'vitest';
import { isPrivateIp } from './private-ip.util.js';

describe('isPrivateIp', () => {
  it.each([
    '10.0.0.1',
    '10.255.255.255',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '127.0.0.1',
    '169.254.169.254', // AWS IMDS
    '0.0.0.0',
    '224.0.0.1', // multicast
  ])('rejects private IPv4 %s', (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '140.82.121.4', '172.15.255.255', '172.32.0.0'])(
    'allows public IPv4 %s',
    (ip) => {
      expect(isPrivateIp(ip)).toBe(false);
    },
  );

  it.each(['::1', '::', 'fe80::1', 'fc00::1', 'fdff::1', '::ffff:127.0.0.1'])(
    'rejects private IPv6 %s',
    (ip) => {
      expect(isPrivateIp(ip)).toBe(true);
    },
  );

  it.each(['2606:4700:4700::1111', '2001:4860:4860::8888'])(
    'allows public IPv6 %s',
    (ip) => {
      expect(isPrivateIp(ip)).toBe(false);
    },
  );

  it('rejects invalid input defensively', () => {
    expect(isPrivateIp('not-an-ip')).toBe(true);
    expect(isPrivateIp('')).toBe(true);
    expect(isPrivateIp('999.999.999.999')).toBe(true);
  });
});
