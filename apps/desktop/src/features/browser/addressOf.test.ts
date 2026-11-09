import { describe, expect, it } from 'vitest';
import { addressOf } from './addressOf';

const urlOf = (text: string) => {
  const address = addressOf({ text });
  return address.kind === 'ok' ? address.url : null;
};

describe('addressOf', () => {
  it('opens a bare host on https', () => {
    expect(urlOf('harborline.dev')).toBe('https://harborline.dev/');
    expect(urlOf('docs.harborline.dev/tax?region=us')).toBe(
      'https://docs.harborline.dev/tax?region=us',
    );
  });

  it('opens localhost and loopback hosts on http', () => {
    expect(urlOf('localhost:5173/checkout')).toBe('http://localhost:5173/checkout');
    expect(urlOf('127.0.0.1:4310')).toBe('http://127.0.0.1:4310/');
    expect(urlOf('acme.localhost')).toBe('http://acme.localhost/');
    expect(urlOf('[::1]:8080')).toBe('http://[::1]:8080/');
  });

  it('keeps https for a host whose first label only looks like loopback', () => {
    expect(urlOf('127.acme.example')).toBe('https://127.acme.example/');
    expect(urlOf('127.0.0.1.northwind.example')).toBe('https://127.0.0.1.northwind.example/');
  });

  it('keeps the scheme a full address names', () => {
    expect(urlOf('https://localhost:5173')).toBe('https://localhost:5173/');
    expect(urlOf('http://northwind.example/orders')).toBe('http://northwind.example/orders');
    expect(urlOf('  https://acme.example  ')).toBe('https://acme.example/');
  });

  it('refuses words, never sending them to a search engine', () => {
    expect(addressOf({ text: 'checkout total' })).toEqual({
      kind: 'refused',
      reason: "Type a full address, like harborline.dev. Search isn't available here.",
    });
    expect(urlOf('payments')).toBeNull();
    expect(urlOf('harborline.')).toBeNull();
  });

  it('refuses every scheme but http and https', () => {
    for (const text of [
      'javascript:alert(1)',
      'file:///etc/hosts',
      'about:blank',
      'data:text/html,x',
    ]) {
      expect(addressOf({ text })).toEqual({
        kind: 'refused',
        reason: 'Only http and https addresses open here.',
      });
    }
  });

  it('asks for an address when the field is empty', () => {
    expect(addressOf({ text: '   ' })).toEqual({ kind: 'refused', reason: 'Type an address.' });
  });
});
