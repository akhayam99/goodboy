import { describe, expect, it, vi } from 'vitest';
import type { GhRunner } from '@goodboy/core';
import { addReportComment, fileReportIssue, findSimilarIssue } from './reportDestination';

const runner = (stdout: string, exitCode = 0, stderr = '') => {
  const run = vi.fn<GhRunner['run']>(async () => ({ stdout, stderr, exitCode }));
  return { run, value: { run } satisfies GhRunner };
};

describe('fileReportIssue', () => {
  it('returns the issue link and number from gh', async () => {
    const gh = runner('Creating issue\nhttps://github.com/akhayam99/goodboy/issues/1917\n');

    const result = await fileReportIssue({ runner: gh.value, title: 'Board jumps', body: 'b' });

    expect(result).toEqual({
      ok: true,
      filed: {
        url: 'https://github.com/akhayam99/goodboy/issues/1917',
        number: 1917,
        kind: 'issue',
      },
    });
  });

  it('says what gh said when it fails', async () => {
    const gh = runner('', 1, 'HTTP 401: Bad credentials');

    const result = await fileReportIssue({ runner: gh.value, title: 'Board jumps', body: 'b' });

    expect(result).toEqual({ ok: false, message: 'HTTP 401: Bad credentials' });
  });
});

describe('addReportComment', () => {
  it('comments on the issue it was given', async () => {
    const gh = runner('https://github.com/akhayam99/goodboy/issues/1542#issuecomment-9\n');

    const result = await addReportComment({ runner: gh.value, number: 1542, body: 'mine too' });

    expect(gh.run.mock.calls[0]?.[0].slice(0, 3)).toEqual(['issue', 'comment', '1542']);
    expect(result.ok && result.filed.number).toBe(1542);
  });
});

describe('findSimilarIssue', () => {
  it('waits for a line long enough to search', async () => {
    const gh = runner('[]');

    expect(await findSimilarIssue({ runner: gh.value, line: 'board' })).toBeNull();
    expect(gh.run).not.toHaveBeenCalled();
  });

  it('reads the first open match', async () => {
    const gh = runner(
      JSON.stringify([
        { number: 1542, title: 'Board reflows', url: 'https://x.invalid/1542', commentsCount: 3 },
      ]),
    );

    const found = await findSimilarIssue({ runner: gh.value, line: 'Board columns jump around' });

    expect(found).toEqual({
      number: 1542,
      title: 'Board reflows',
      url: 'https://x.invalid/1542',
      comments: 3,
    });
    expect(gh.run.mock.calls[0]?.[0]).toContain('--state');
  });

  it('searches with the filtered line, never a token', async () => {
    const gh = runner('[]');

    await findSimilarIssue({
      runner: gh.value,
      line: 'push fails with ghp_AbCdEfGhIjKlMnOpQrSt1234',
    });

    expect(gh.run.mock.calls[0]?.[0][2]).not.toContain('ghp_AbCd');
  });

  it('treats unreadable output as no match', async () => {
    const gh = runner('not json');

    expect(
      await findSimilarIssue({ runner: gh.value, line: 'Board columns jump around' }),
    ).toBeNull();
  });
});
