import { describe, expect, it } from 'vitest';
import { buildCrashReport, CRASH_TRACE_BUDGET } from './buildCrashReport';
import { isOpenableUrl } from './components/ReportIssueStudio/issuePayload';
import { MAX_ISSUE_URL_BYTES } from './issueUrl';

const errorWith = (message: string): Error => new Error(message);

describe('buildCrashReport', () => {
  it('carries no home path into the issue url', () => {
    const report = buildCrashReport({
      error: errorWith('cannot read bg of undefined in /Users/ada/goodboy/App.tsx'),
      componentStack: '\n    at Row (/Users/ada/goodboy/src/Row.tsx:12)',
      version: '0.1.81',
    });

    expect(report.body).not.toContain('/Users/ada');
    expect(report.url).not.toContain('%2FUsers%2Fada');
    expect(report.body).toContain('~/…/App.tsx');
    expect(report.body).toContain('at Row (~/…/Row.tsx:12)');
  });

  it('carries no secret or email from the error into the title or body', () => {
    const report = buildCrashReport({
      error: errorWith('401 for rowan@example.dev with ghp_AbCdEfGhIjKlMnOpQrStUv123456'),
      componentStack: null,
      version: '0.1.81',
    });

    expect(report.title).not.toContain('ghp_AbCdEfGhIjKlMnOpQrStUv123456');
    expect(report.body).not.toContain('ghp_AbCdEfGhIjKlMnOpQrStUv123456');
    expect(report.body).not.toContain('rowan@example.dev');
  });

  it('opens a prefill form and never posts', () => {
    const report = buildCrashReport({
      error: errorWith('boom'),
      componentStack: null,
      version: '0.1.81',
    });

    expect(report.url.startsWith('https://github.com/')).toBe(true);
    expect(report.url).toContain('/issues/new?');
    expect(report.url).not.toContain('token');
  });

  it('cuts an oversized stack at the stated budget and says how much was left out', () => {
    const report = buildCrashReport({
      error: errorWith('boom'),
      componentStack: 'x'.repeat(CRASH_TRACE_BUDGET + 240),
      version: '0.1.81',
    });

    expect(report.body).toContain('240 more characters were not included');
    expect(report.body).not.toContain('x'.repeat(CRASH_TRACE_BUDGET + 1));
  });

  it('keeps a stack that fits whole', () => {
    const report = buildCrashReport({
      error: errorWith('boom'),
      componentStack: '    at Row (src/Row.tsx:12)',
      version: '0.1.81',
    });

    expect(report.body).toContain('at Row (src/Row.tsx:12)');
    expect(report.body).not.toContain('were not included');
  });

  it('says the version is unknown rather than inventing one', () => {
    const report = buildCrashReport({
      error: errorWith('boom'),
      componentStack: null,
      version: null,
    });

    expect(report.body).toContain('Version: unknown');
  });

  it('keeps the whole report link inside the length the shell will open', () => {
    const report = buildCrashReport({
      error: errorWith('b'.repeat(20000)),
      componentStack: 'x'.repeat(CRASH_TRACE_BUDGET + 5000),
      version: '0.1.81',
    });

    expect(report.url.length).toBeLessThanOrEqual(MAX_ISSUE_URL_BYTES);
    expect(report.body).toContain('did not fit the report link');
  });

  it('names the error kind in the title and never the message', () => {
    const report = buildCrashReport({
      error: new TypeError('fetch failed: Authorization: Bearer sk-ant-api03-AbCdEfGhIjKlMnOp'),
      componentStack: null,
      version: '0.1.81',
    });

    expect(report.title).toBe('Crash: TypeError');
  });

  it('falls back to a plain title when the error name is not a plain identifier', () => {
    const error = errorWith('boom');
    error.name = `leak ${'t'.repeat(20000)}`;
    const report = buildCrashReport({ error, componentStack: null, version: '0.1.81' });

    expect(report.title).toBe('Crash: runtime error');
    expect(report.url.length).toBeLessThanOrEqual(MAX_ISSUE_URL_BYTES);
  });

  it('removes secrets, emails, link queries and home paths from the message and the stack', () => {
    const report = buildCrashReport({
      error: errorWith(
        'fetch https://api.github.com/graphql?access_token=abc123def456 failed for rowan@example.dev: Authorization: Bearer sk-ant-api03-AbCdEfGhIjKlMnOp',
      ),
      componentStack:
        '\n    at Row (/Users/rowan/code/harborline/src/Row.tsx:12) ghp_AbCdEfGhIjKlMnOpQrSt1234',
      version: '0.1.81',
    });
    const decoded = decodeURIComponent(report.url);

    for (const leak of [
      'sk-ant-api03',
      'ghp_AbCd',
      'access_token',
      'rowan@example.dev',
      '/Users/rowan',
    ]) {
      expect(report.body).not.toContain(leak);
      expect(report.title).not.toContain(leak);
      expect(decoded).not.toContain(leak);
    }
    expect(report.body).toContain('https://api.github.com/… failed');
    expect(report.body).toContain('~/…/Row.tsx:12');
  });

  it('cuts the stack further when the capped stack alone overflows the link', () => {
    const report = buildCrashReport({
      error: errorWith('boom'),
      componentStack: `a${'\n'.repeat(1600)}b`,
      version: '0.1.81',
    });

    expect(report.url.length).toBeLessThanOrEqual(MAX_ISSUE_URL_BYTES);
    expect(report.body).toContain('the rest of the stack did not fit the report link');
  });

  it('builds an openable link from a message carrying a lone surrogate', () => {
    const report = buildCrashReport({
      error: errorWith('boom \uD800 end'),
      componentStack: null,
      version: '0.1.81',
    });

    expect(isOpenableUrl(report.url)).toBe(true);
  });
});
