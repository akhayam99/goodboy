import { describe, expect, it } from 'vitest';
import { buildCrashReport, collapseHomePaths, CRASH_TRACE_BUDGET } from './buildCrashReport';
import { isOpenableUrl } from './components/ReportIssueStudio/issuePayload';
import { MAX_ISSUE_URL_BYTES } from './issueUrl';

const errorWith = (message: string): Error => new Error(message);

describe('collapseHomePaths', () => {
  it('shortens a macOS home folder to a tilde', () => {
    expect(collapseHomePaths({ text: 'at /Users/ada/goodboy/src/App.tsx:3' })).toBe(
      'at ~/goodboy/src/App.tsx:3',
    );
  });

  it('shortens a linux home folder to a tilde', () => {
    expect(collapseHomePaths({ text: 'at /home/ada/goodboy/src/App.tsx' })).toBe(
      'at ~/goodboy/src/App.tsx',
    );
  });

  it('shortens a windows home folder to a tilde', () => {
    expect(collapseHomePaths({ text: 'at C:\\Users\\ada\\goodboy\\App.tsx' })).toBe(
      'at ~\\goodboy\\App.tsx',
    );
  });

  it('leaves a path outside a home folder alone', () => {
    expect(collapseHomePaths({ text: 'at /opt/goodboy/App.tsx' })).toBe('at /opt/goodboy/App.tsx');
  });
});

describe('buildCrashReport', () => {
  it('carries no home path into the issue url', () => {
    const report = buildCrashReport({
      error: errorWith('cannot read bg of undefined in /Users/ada/goodboy/App.tsx'),
      componentStack: '\n    at Row (/Users/ada/goodboy/src/Row.tsx:12)',
      version: '0.1.81',
    });

    expect(report.body).not.toContain('/Users/ada');
    expect(report.url).not.toContain('%2FUsers%2Fada');
    expect(report.body).toContain('~/goodboy/App.tsx');
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

  it('caps a runaway title instead of letting it fill the link', () => {
    const report = buildCrashReport({
      error: errorWith('t'.repeat(20000)),
      componentStack: null,
      version: '0.1.81',
    });

    expect(report.url.length).toBeLessThanOrEqual(MAX_ISSUE_URL_BYTES);
    expect(report.title.endsWith('…')).toBe(true);
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
