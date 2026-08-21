import { describe, expect, it } from 'vitest';
import { REPORT_ISSUE_REPO } from '../../issueUrl';
import { buildFallbackIssue, buildIssueBody, isOpenableUrl } from './issuePayload';

const MAX_URL = 4096;

const decode = (url: string): { title: string; body: string } => {
  const params = new URL(url).searchParams;
  return { title: params.get('title') ?? '', body: params.get('body') ?? '' };
};

describe('buildIssueBody', () => {
  it('contains only the type, version, area label and notes', () => {
    const body = buildIssueBody({
      typeLabel: 'Bug',
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: 'The board freezes after archiving a session.',
    });
    expect(body).toBe(
      'Type: Bug\nArea: Board and sessions\nVersion: 0.1.69\n\nThe board freezes after archiving a session.',
    );
  });

  it('names the staged screenshots so the reporter can drag them in', () => {
    const body = buildIssueBody({
      typeLabel: 'Bug',
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: 'The board freezes after archiving a session.',
      imageNames: ['board.png', 'console.png'],
    });
    expect(body).toContain('Screenshots to drag into this issue: board.png, console.png');
  });
});

describe('buildFallbackIssue', () => {
  it('does not truncate short notes', () => {
    const result = buildFallbackIssue({
      title: 'Board freeze',
      typeLabel: 'Bug',
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: 'Short repro.',
    });
    expect(result.titleTruncated).toBe(false);
    expect(result.notesTruncated).toBe(false);
    expect(result.body).toContain('Short repro.');
    expect(result.url.length).toBeLessThanOrEqual(MAX_URL);
  });

  it('targets the fixed repo and percent-encodes title and body', () => {
    const result = buildFallbackIssue({
      title: 'Board freeze',
      typeLabel: 'Bug',
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: 'Steps & details',
    });
    expect(result.url.startsWith(`https://github.com/${REPORT_ISSUE_REPO}/issues/new?`)).toBe(true);
    expect(result.url).toContain('title=Board%20freeze');
    expect(result.url).toContain('%26');
  });

  it('encodes exactly the previewed title and body into an untruncated url', () => {
    const result = buildFallbackIssue({
      title: 'Board freeze',
      typeLabel: 'Bug',
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: 'Steps & details, with a "quote" and a #hash.',
    });
    expect(result.notesTruncated).toBe(false);
    expect(decode(result.url)).toEqual({ title: result.title, body: result.body });
  });

  it('encodes exactly the previewed title and body into a truncated url too', () => {
    const result = buildFallbackIssue({
      title: 'Board freeze',
      typeLabel: 'Bug',
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: 'x'.repeat(6000),
    });
    expect(result.notesTruncated).toBe(true);
    expect(decode(result.url)).toEqual({ title: result.title, body: result.body });
  });

  it('truncates notes long enough to blow the fallback URL cap, and stays visibly under it', () => {
    const longNotes = 'x'.repeat(6000);
    const result = buildFallbackIssue({
      title: 'Board freeze',
      typeLabel: 'Bug',
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: longNotes,
    });
    expect(result.notesTruncated).toBe(true);
    expect(result.titleTruncated).toBe(false);
    expect(result.url.length).toBeLessThanOrEqual(MAX_URL);
    expect(result.body).not.toContain(longNotes);
    expect(result.body).toContain('truncated');
  });

  it('keeps the fallback URL byte-safe even for wide unicode notes', () => {
    const longNotes = '🐛'.repeat(2000);
    const result = buildFallbackIssue({
      title: 'Board freeze',
      typeLabel: 'Bug',
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: longNotes,
    });
    expect(result.notesTruncated).toBe(true);
    expect(result.url.length).toBeLessThanOrEqual(MAX_URL);
  });

  it('caps a title that blows the URL on its own, and keeps the notes intact', () => {
    const result = buildFallbackIssue({
      title: 'T'.repeat(5000),
      typeLabel: 'Bug',
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: 'short',
    });
    expect(result.titleTruncated).toBe(true);
    expect(result.notesTruncated).toBe(false);
    expect(result.title.endsWith('…')).toBe(true);
    expect(result.body).toContain('short');
    expect(result.url.length).toBeLessThanOrEqual(MAX_URL);
    expect(isOpenableUrl(result.url)).toBe(true);
  });

  it('caps a wide unicode title too', () => {
    const result = buildFallbackIssue({
      title: '🐛'.repeat(2000),
      typeLabel: 'Bug',
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: 'short',
    });
    expect(result.titleTruncated).toBe(true);
    expect(result.notesTruncated).toBe(false);
    expect(isOpenableUrl(result.url)).toBe(true);
  });

  it('caps both the title and the notes when both are overlong', () => {
    const result = buildFallbackIssue({
      title: 'T'.repeat(5000),
      typeLabel: 'Bug',
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: 'x'.repeat(6000),
    });
    expect(result.titleTruncated).toBe(true);
    expect(result.notesTruncated).toBe(true);
    expect(isOpenableUrl(result.url)).toBe(true);
    expect(decode(result.url)).toEqual({ title: result.title, body: result.body });
  });

  it('stays openable across the title lengths that used to overflow the cap', () => {
    const lengths = [0, 1, 3900, 3951, 3999, 4000, 4001, 4096, 4097, 5000, 20000];
    const failures = lengths.filter(
      (length) =>
        !isOpenableUrl(
          buildFallbackIssue({
            title: 'T'.repeat(length),
            typeLabel: 'Bug',
            version: '0.1.69',
            areaLabel: 'Board and sessions',
            notes: 'Freezes on archive.',
          }).url,
        ),
    );
    expect(failures).toEqual([]);
  });

  it('replaces a lone surrogate in the notes instead of throwing', () => {
    const result = buildFallbackIssue({
      title: 'Board freeze',
      typeLabel: 'Bug',
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: 'a\uD83D b',
    });
    expect(result.body).toContain('a� b');
    expect(isOpenableUrl(result.url)).toBe(true);
  });

  it('replaces a lone surrogate in the title instead of throwing', () => {
    const result = buildFallbackIssue({
      title: 'Board\uDC00freeze',
      typeLabel: 'Bug',
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: 'Freezes on archive.',
    });
    expect(result.title).toBe('Board�freeze');
    expect(isOpenableUrl(result.url)).toBe(true);
  });

  it('leaves a valid surrogate pair alone', () => {
    const result = buildFallbackIssue({
      title: 'Board freeze 🐛',
      typeLabel: 'Bug',
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: 'Freezes on archive 🐛',
    });
    expect(result.title).toBe('Board freeze 🐛');
    expect(result.body).toContain('Freezes on archive 🐛');
  });

  it('survives a long note that ends on a lone high surrogate', () => {
    const result = buildFallbackIssue({
      title: 'Board freeze',
      typeLabel: 'Bug',
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: `${'x'.repeat(6000)}\uD83D`,
    });
    expect(result.notesTruncated).toBe(true);
    expect(isOpenableUrl(result.url)).toBe(true);
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
      typeLabel: 'Bug',
      version: '0.1.69',
      areaLabel: 'Board and sessions',
      notes: 'x'.repeat(6000),
    });
    expect(isOpenableUrl(result.url)).toBe(true);
  });
});
