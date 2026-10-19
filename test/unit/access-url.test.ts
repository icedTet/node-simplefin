import { describe, expect, it } from 'vitest';
import { parseAccessUrl } from '../../src/access-url';

describe('parseAccessUrl', () => {
  it('splits credentials from a canonical access URL', () => {
    const parsed = parseAccessUrl('https://abc123:def456@bridge.example.com/simplefin');
    expect(parsed.username).toBe('abc123');
    expect(parsed.password).toBe('def456');
    expect(parsed.root.href).toBe('https://bridge.example.com/simplefin/');
    expect(parsed.root.username).toBe('');
    expect(parsed.root.password).toBe('');
  });

  it('exposes a redacted href that never contains the secret', () => {
    const parsed = parseAccessUrl('https://abc123:topsecret@host.example/x/');
    expect(parsed.href).toBe('https://host.example/x/');
    expect(parsed.href).not.toContain('topsecret');
  });

  it('decodes percent-encoded credentials', () => {
    const parsed = parseAccessUrl('https://user%40name:p%61ss@host.example/simplefin');
    expect(parsed.username).toBe('user@name');
    expect(parsed.password).toBe('pass');
  });

  it('rejects insecure, credential-less, and relative URLs', () => {
    expect(() => parseAccessUrl('http://a:b@host/simplefin')).toThrow(/https/);
    expect(() => parseAccessUrl('https://host/simplefin')).toThrow(/credentials/);
    expect(() => parseAccessUrl('https://onlyuser@host/simplefin')).toThrow(/credentials/);
    expect(() => parseAccessUrl('relative/path')).toThrow(/absolute/);
  });

  it('trims surrounding whitespace', () => {
    expect(() => parseAccessUrl('  https://a:b@host/sf\n')).not.toThrow();
  });
});
