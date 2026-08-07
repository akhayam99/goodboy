import { describe, expect, it } from 'vitest';
import { parseIssueCreateResult } from './parseIssueCreateResult';

describe('parseIssueCreateResult', () => {
  it('surfaces stderr when the exit code is non-zero', () => {
    const result = parseIssueCreateResult({
      stdout: '',
      stderr: 'HTTP 403: Resource not accessible by personal access token',
      exitCode: 1,
    });
    expect(result).toEqual({
      ok: false,
      message: 'HTTP 403: Resource not accessible by personal access token',
    });
  });

  it('falls back to a generic message when stderr is empty on failure', () => {
    const result = parseIssueCreateResult({ stdout: '', stderr: '   ', exitCode: 7 });
    expect(result).toEqual({ ok: false, message: 'gh issue create exited with 7' });
  });

  it('extracts the issue url from the last non-empty stdout line', () => {
    const result = parseIssueCreateResult({
      stdout:
        'Creating issue in akhayam99/goodboy\n\nhttps://github.com/akhayam99/goodboy/issues/42\n',
      stderr: '',
      exitCode: 0,
    });
    expect(result).toEqual({ ok: true, url: 'https://github.com/akhayam99/goodboy/issues/42' });
  });

  it('treats success with unparsable stdout as created without a link', () => {
    const result = parseIssueCreateResult({ stdout: 'not a url', stderr: '', exitCode: 0 });
    expect(result).toEqual({ ok: true, url: null });
  });

  it('does not treat a non-github url as the issue link', () => {
    const result = parseIssueCreateResult({
      stdout: 'https://example.com/not-github',
      stderr: '',
      exitCode: 0,
    });
    expect(result).toEqual({ ok: true, url: null });
  });
});
