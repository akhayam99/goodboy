import { describe, expect, it } from 'vitest';
import {
  buildFallbackIssue,
  buildFallbackIssueUrl,
  buildIssueBody,
  isOpenableUrl,
  REPORT_ISSUE_REPO,
} from './issuePayload';

describe('buildIssueBody', () => {
  it('contains only the version, area label and notes', () => {
    const body = buildIssueBody({
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: 'The board freezes after archiving a session.',
    });
    expect(body).toBe(
      'Area: Board and sessions\nVersion: 0.1.69\n\nThe board freezes after archiving a session.',
    );
  });
});

describe('buildFallbackIssueUrl', () => {
  it('targets the fixed repo and percent-encodes title and body', () => {
    const url = buildFallbackIssueUrl({ title: 'Board freeze', body: 'Steps & details' });
    expect(url.startsWith(`https://github.com/${REPORT_ISSUE_REPO}/issues/new?`)).toBe(true);
    expect(url).toContain('title=Board%20freeze');
    expect(url).toContain('body=Steps%20%26%20details');
  });
});

describe('buildFallbackIssue', () => {
  it('does not truncate short notes', () => {
    const result = buildFallbackIssue({
      title: 'Board freeze',
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: 'Short repro.',
    });
    expect(result.truncated).toBe(false);
    expect(result.body).toContain('Short repro.');
    expect(result.url.length).toBeLessThanOrEqual(4096);
  });

  it('truncates notes long enough to blow the fallback URL cap, and stays visibly under it', () => {
    const longNotes = 'x'.repeat(6000);
    const result = buildFallbackIssue({
      title: 'Board freeze',
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: longNotes,
    });
    expect(result.truncated).toBe(true);
    expect(result.url.length).toBeLessThanOrEqual(4096);
    expect(result.body).not.toContain(longNotes);
    expect(result.body).toContain('truncated');
  });

  it('keeps the fallback URL byte-safe even for wide unicode notes', () => {
    const longNotes = '🐛'.repeat(2000);
    const result = buildFallbackIssue({
      title: 'Board freeze',
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: longNotes,
    });
    expect(result.truncated).toBe(true);
    expect(result.url.length).toBeLessThanOrEqual(4096);
  });
});

describe('isOpenableUrl', () => {
  it('accepts a plain https url', () => {
    expect(isOpenableUrl('https://github.com/akhayam99/goodboy/issues/new?title=x')).toBe(true);
  });

  it('rejects a url over the byte cap', () => {
    expect(isOpenableUrl(`https://github.com/x?body=${'a'.repeat(4090)}`)).toBe(false);
  });

  it('rejects a non-http scheme', () => {
    expect(isOpenableUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects a url carrying a forbidden character', () => {
    expect(isOpenableUrl('https://github.com/x?body=<script>')).toBe(false);
  });

  it('rejects a url carrying raw whitespace', () => {
    expect(isOpenableUrl('https://github.com/x?body=a b')).toBe(false);
  });

  it('accepts every fallback url this module can produce', () => {
    const result = buildFallbackIssue({
      title: 'Board freeze',
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: 'x'.repeat(6000),
    });
    expect(isOpenableUrl(result.url)).toBe(true);
  });
});
