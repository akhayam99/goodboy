import { describe, expect, it } from 'vitest';
import { sessionContextDigest } from './sessionContextDigest';

describe('sessionContextDigest', () => {
  it('counts nothing on an empty context', () => {
    const digest = sessionContextDigest({ decisions: '', summary: '' });

    expect(digest.decisions).toEqual({ count: 0, excerpt: '' });
    expect(digest.summary).toEqual({ count: 0, excerpt: '' });
  });

  it('counts the decision rows and quotes the first', () => {
    const digest = sessionContextDigest({
      decisions: '- Keep the SQLite store\n- Drop the legacy poller\n',
      summary: '',
    });

    expect(digest.decisions.count).toBe(2);
    expect(digest.decisions.excerpt).toBe('Keep the SQLite store');
  });

  it('counts only the summary blocks that carry text', () => {
    const digest = sessionContextDigest({
      decisions: '',
      summary: '#### Problem\nThe redirect loops.\n\n#### Next\n',
    });

    expect(digest.summary.count).toBe(1);
    expect(digest.summary.excerpt).toBe('The redirect loops.');
  });

  it('skips the blank lines under a heading when quoting', () => {
    const digest = sessionContextDigest({
      decisions: '',
      summary: '#### State\n\n\n   Two mounts are still dirty.\n',
    });

    expect(digest.summary.excerpt).toBe('Two mounts are still dirty.');
  });
});
