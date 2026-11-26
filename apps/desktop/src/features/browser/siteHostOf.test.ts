import { describe, expect, it } from 'vitest';
import { siteHostOf } from './siteHostOf';

describe('siteHostOf', () => {
  it('names the host of a web page without its port', () => {
    expect(siteHostOf({ url: 'http://localhost:5005/login' })).toBe('localhost');
    expect(siteHostOf({ url: 'https://App.Acme.test/checkout' })).toBe('app.acme.test');
    expect(siteHostOf({ url: 'http://127.0.0.1:8080/' })).toBe('127.0.0.1');
  });

  it('has no site for a file, a blank page or no address', () => {
    for (const url of ['file:///work/harborline/plan.html', 'about:blank', '', 'not an address']) {
      expect(siteHostOf({ url })).toBeNull();
    }
  });
});
