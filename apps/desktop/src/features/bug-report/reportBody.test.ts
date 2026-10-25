// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildReport,
  buildReportLink,
  contextParts,
  errorPart,
  noticePart,
  previewSummary,
  trimStack,
  type ReportPartId,
} from './reportBody';

const CONTEXT = {
  version: '0.12.0',
  build: '7f3a2c1',
  system: 'macOS 26.0 arm64',
  screen: 'Session › Agents',
  cliVersions: 'Claude CLI 2.1.260',
};

const NONE: ReadonlySet<ReportPartId> = new Set();

describe('contextParts', () => {
  it('shows no chip for a version or a system it could not read', () => {
    const parts = contextParts({
      context: { ...CONTEXT, version: 'unknown', build: 'unknown', system: 'unknown' },
    });

    expect(parts.map((part) => part.id)).toEqual(['screen', 'cliVersions']);
  });

  it('keeps a known build on its own chip when the version is unknown', () => {
    const parts = contextParts({ context: { ...CONTEXT, version: 'unknown' } });

    expect(parts[0]).toMatchObject({
      id: 'version',
      chip: 'build 7f3a2c1',
      text: 'Build: 7f3a2c1',
    });
  });

  it('keeps a known version alone when the build is unknown', () => {
    const parts = contextParts({ context: { ...CONTEXT, build: 'unknown' } });

    expect(parts[0]).toMatchObject({ id: 'version', chip: '0.12.0', text: 'Version: 0.12.0' });
  });

  it('keeps every chip when the version and the system are known', () => {
    expect(contextParts({ context: CONTEXT }).map((part) => part.id)).toEqual([
      'version',
      'system',
      'screen',
      'cliVersions',
    ]);
  });
});

describe('buildReport', () => {
  it('makes the one line the title and lists every attached fact under the type', () => {
    const report = buildReport({
      issueType: 'bug',
      line: '  Retry spins   forever ',
      detail: '',
      parts: contextParts({ context: CONTEXT }),
      excluded: NONE,
    });

    expect(report.title).toBe('Retry spins forever');
    expect(report.body).toBe(
      [
        'Type: Bug',
        'Version: 0.12.0 (build 7f3a2c1)',
        'System: macOS 26.0 arm64',
        'Screen: Session › Agents',
        'CLI versions: Claude CLI 2.1.260',
      ].join('\n'),
    );
  });

  it('leaves out a removed part and keeps the rest', () => {
    const report = buildReport({
      issueType: 'idea',
      line: 'Group the board by project',
      detail: 'Today it is one long column.',
      parts: contextParts({ context: CONTEXT }),
      excluded: new Set<ReportPartId>(['system', 'cliVersions']),
    });

    expect(report.body).toBe(
      'Today it is one long column.\n\nType: Idea\nVersion: 0.12.0 (build 7f3a2c1)\nScreen: Session › Agents',
    );
  });

  it('drops tokens the user pasted into the line or the detail', () => {
    const report = buildReport({
      issueType: 'bug',
      line: 'push fails with ghp_AbCdEfGhIjKlMnOpQrSt1234',
      detail: 'Authorization: Bearer sk-ant-api03-AbCdEfGhIjKlMnOp',
      parts: [],
      excluded: NONE,
    });

    expect(report.title).not.toContain('ghp_AbCd');
    expect(report.body).not.toContain('sk-ant-api03');
  });

  it('puts the error and the notification in fenced blocks after the facts', () => {
    const report = buildReport({
      issueType: 'bug',
      line: 'Crash: TypeError',
      detail: '',
      parts: [
        errorPart({ message: 'x is undefined', stack: 'at Row (Row.tsx:4)', componentStack: '' }),
        noticePart({ title: 'Push failed', body: 'gh: HTTP 502' }),
      ],
      excluded: NONE,
    });

    expect(report.body).toContain('Type: Bug\n\n**Error**\n```\nx is undefined\n```');
    expect(report.body).toContain('**Stack**\n```\nat Row (Row.tsx:4)\n```');
    expect(report.body).toContain('**Notification**\n```\nPush failed\n\ngh: HTTP 502\n```');
  });
});

describe('trimStack', () => {
  it('keeps only our frames, capped', () => {
    const ours = Array.from(
      { length: 12 },
      (_, index) => `    at Row${index} (/src/Row.tsx:${index})`,
    );
    const stack = [
      'TypeError: x is undefined',
      '    at renderWithHooks (/node_modules/.vite/deps/react-dom.js:1)',
      ...ours,
      '    at workLoop (/node_modules/scheduler/index.js:2)',
    ].join('\n');

    const trimmed = trimStack({ stack }).split('\n');

    expect(trimmed).toHaveLength(8);
    expect(trimmed[0]).toBe('at Row0 (/src/Row.tsx:0)');
    expect(trimmed.join('\n')).not.toContain('node_modules');
  });

  it('is empty when there is no stack', () => {
    expect(trimStack({ stack: undefined })).toBe('');
  });
});

describe('previewSummary', () => {
  it('counts the placeholders the filter left in the attached parts', () => {
    const parts = [
      noticePart({ title: 'Push failed for [email]', body: 'in ~/… with [redacted]' }),
    ];

    expect(previewSummary({ parts, excluded: NONE })).toBe(
      '3 things redacted · nothing from your prompts',
    );
    expect(previewSummary({ parts, excluded: new Set<ReportPartId>(['notice']) })).toBe(
      'nothing redacted · nothing from your prompts',
    );
  });
});

describe('buildReportLink', () => {
  it('carries the whole report when it fits', () => {
    const link = buildReportLink({ title: 'Board jumps', body: 'Type: Bug' });

    expect(link.overflows).toBe(false);
    expect(decodeURIComponent(link.url)).toContain('body=Type: Bug');
  });

  it('cuts a long body to the link cap and says the rest is on the clipboard', () => {
    const link = buildReportLink({ title: 'Board jumps', body: 'steps '.repeat(2000) });

    expect(link.overflows).toBe(true);
    expect(link.url.length).toBeLessThanOrEqual(4096);
    expect(decodeURIComponent(link.url)).toContain('It is on your clipboard');
  });
});
