import { describe, expect, it } from 'vitest';
import { buildCrashReport, collapseHomePaths, CRASH_TRACE_BUDGET } from './buildCrashReport';

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
});
