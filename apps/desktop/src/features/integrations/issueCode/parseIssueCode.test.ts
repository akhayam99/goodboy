// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseIssueCode } from './parseIssueCode';

describe('parseIssueCode', () => {
  it.each([
    ['CAS-231', { kind: 'key', code: 'CAS-231', prefix: 'CAS', number: 231 }],
    ['  cas-231 ', { kind: 'key', code: 'CAS-231', prefix: 'CAS', number: 231 }],
    ['NW-142', { kind: 'key', code: 'NW-142', prefix: 'NW', number: 142 }],
    ['NOTIFY-3F', { kind: 'shortId', code: 'NOTIFY-3F', prefix: 'NOTIFY' }],
    ['payments-api-1a', { kind: 'shortId', code: 'PAYMENTS-API-1A', prefix: 'PAYMENTS-API' }],
    ['NOTIFY-12', { kind: 'key', code: 'NOTIFY-12', prefix: 'NOTIFY', number: 12 }],
    ['#482', { kind: 'number', number: 482 }],
    [
      'acme/storefront-web#482',
      { kind: 'slugNumber', slug: 'acme/storefront-web', number: 482, host: 'github-or-gitlab' },
    ],
    [
      'payments/api/core#12',
      { kind: 'slugNumber', slug: 'payments/api/core', number: 12, host: 'gitlab' },
    ],
  ])('reads %s', (input, expected) => {
    expect(parseIssueCode(input)).toEqual(expected);
  });

  it.each(['webhook', '482', 'error 500', '', 'fix the ledger', '-12', 'CAS-'])(
    'leaves %s as text',
    (input) => {
      expect(parseIssueCode(input)).toEqual({ kind: 'text' });
    },
  );

  it('reads a link from every tracker host', () => {
    expect(parseIssueCode('https://linear.app/cascadia/issue/CAS-231/fix-the-close')).toEqual({
      kind: 'url',
      url: { provider: 'linear', identifier: 'CAS-231' },
    });
    expect(parseIssueCode('https://northwind.atlassian.net/browse/NW-142')).toEqual({
      kind: 'url',
      url: { provider: 'jira', key: 'NW-142', host: 'northwind.atlassian.net' },
    });
    expect(parseIssueCode('https://github.com/acme/storefront-web/issues/482')).toEqual({
      kind: 'url',
      url: { provider: 'github', repo: 'acme/storefront-web', number: 482 },
    });
    expect(parseIssueCode('https://gitlab.acme.dev/payments/api/-/issues/12')).toEqual({
      kind: 'url',
      url: { provider: 'gitlab', host: 'gitlab.acme.dev', projectPath: 'payments/api', iid: 12 },
    });
    expect(parseIssueCode('https://acme.sentry.io/issues/4812/')).toEqual({
      kind: 'url',
      url: { provider: 'sentry', issueId: '4812' },
    });
  });

  it('leaves a link it does not know as text', () => {
    expect(parseIssueCode('https://acme.test/tickets/12')).toEqual({ kind: 'text' });
    expect(parseIssueCode('https://github.com/acme/storefront-web/pull/482')).toEqual({
      kind: 'text',
    });
  });
});
