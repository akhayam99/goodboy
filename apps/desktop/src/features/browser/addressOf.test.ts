import { describe, expect, it } from 'vitest';
import { addressOf } from './addressOf';

type Params = {
  readonly text: string;
};

const urlOf = ({ text }: Params) => {
  const address = addressOf({ text });
  return address.kind === 'ok' ? address.url : null;
};

describe('addressOf', () => {
  it('opens a bare host on https', () => {
    expect(urlOf({ text: 'harborline.dev' })).toBe('https://harborline.dev/');
    expect(urlOf({ text: 'docs.harborline.dev/tax?region=us' })).toBe(
      'https://docs.harborline.dev/tax?region=us',
    );
  });

  it('opens localhost and loopback hosts on http', () => {
    expect(urlOf({ text: 'localhost:5173/checkout' })).toBe('http://localhost:5173/checkout');
    expect(urlOf({ text: '127.0.0.1:4310' })).toBe('http://127.0.0.1:4310/');
    expect(urlOf({ text: 'acme.localhost' })).toBe('http://acme.localhost/');
    expect(urlOf({ text: '[::1]:8080' })).toBe('http://[::1]:8080/');
  });

  it('keeps https for a host whose first label only looks like loopback', () => {
    expect(urlOf({ text: '127.acme.example' })).toBe('https://127.acme.example/');
    expect(urlOf({ text: '127.0.0.1.northwind.example' })).toBe(
      'https://127.0.0.1.northwind.example/',
    );
  });

  it('keeps the scheme a full address names', () => {
    expect(urlOf({ text: 'https://localhost:5173' })).toBe('https://localhost:5173/');
    expect(urlOf({ text: 'http://northwind.example/orders' })).toBe(
      'http://northwind.example/orders',
    );
    expect(urlOf({ text: '  https://acme.example  ' })).toBe('https://acme.example/');
  });

  it('refuses words, never sending them to a search engine', () => {
    expect(addressOf({ text: 'checkout total' })).toEqual({
      kind: 'refused',
      reason:
        "Type a full address, like harborline.dev, or a file path. Search isn't available here.",
    });
    expect(urlOf({ text: 'payments' })).toBeNull();
    expect(urlOf({ text: 'harborline.' })).toBeNull();
  });

  it('refuses every scheme but http, https and file', () => {
    for (const text of ['javascript:alert(1)', 'about:blank', 'data:text/html,x', 'blob:x']) {
      expect(addressOf({ text })).toEqual({
        kind: 'refused',
        reason: 'Only web addresses and local files open here.',
      });
    }
  });

  it('takes an absolute path, a home path and a file address as a local file', () => {
    for (const text of [
      '/work/harborline/plan.html',
      '~/harborline/plan v2.html',
      'file:///work/harborline/plan.html',
      '  ~/harborline/plan.html  ',
      'C:\\work\\harborline\\plan.html',
      'c:/work/harborline/plan.html',
    ]) {
      expect(addressOf({ text })).toEqual({ kind: 'local', path: text.trim() });
    }
  });

  it('never reads a relative path or a network path as a local file', () => {
    expect(addressOf({ text: 'harborline/plan.html' }).kind).not.toBe('local');
    expect(addressOf({ text: '//acme.example/plan.html' }).kind).not.toBe('local');
    expect(addressOf({ text: '~harborline/plan.html' }).kind).toBe('refused');
    expect(addressOf({ text: 'C:plan.html' }).kind).toBe('refused');
  });

  it('asks for an address when the field is empty', () => {
    expect(addressOf({ text: '   ' })).toEqual({ kind: 'refused', reason: 'Type an address.' });
  });
});
