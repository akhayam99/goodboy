import { describe, expect, it } from 'vitest';
import { linkWorkView, type LinkWorkItem } from './linkWorkRows';

type ItemParams = {
  readonly key: string;
  readonly updatedAt: string;
};

const item = ({ key, updatedAt }: ItemParams): LinkWorkItem => ({
  key,
  updatedAt,
  status: 'Open',
  task: {
    provider: 'github',
    externalId: key,
    identifier: key,
    url: `https://example.test/${key}`,
    title: key,
  },
});

const keysOf = (items: ReadonlyArray<LinkWorkItem>): ReadonlyArray<string> => {
  const view = linkWorkView({
    query: '',
    source: 'all',
    items,
    lookedUp: [],
    linkedKeys: new Set(),
  });
  return view.kind === 'list' ? view.rows.map((row) => row.key) : [];
};

describe('linkWorkView', () => {
  it('orders a Jira offset and a GitHub Z by the real instant', () => {
    const jira = item({ key: 'jira', updatedAt: '2026-09-29T10:30:00.000+0200' });
    const github = item({ key: 'github', updatedAt: '2026-09-29T09:00:00.000Z' });

    expect(keysOf([jira, github])).toEqual(['github', 'jira']);
  });

  it('breaks a same-instant tie by key, whatever the input order', () => {
    const first = item({ key: 'a', updatedAt: '2026-09-29T08:00:00Z' });
    const second = item({ key: 'b', updatedAt: '2026-09-29T10:00:00+0200' });

    expect(keysOf([second, first])).toEqual(['a', 'b']);
    expect(keysOf([first, second])).toEqual(['a', 'b']);
  });
});

describe('linkWorkView with linked keys', () => {
  const rowsOf = (linkedKeys: ReadonlySet<string>) => {
    const view = linkWorkView({
      query: '',
      source: 'all',
      items: [
        item({ key: 'revamp', updatedAt: '2026-09-29T08:00:00Z' }),
        item({ key: 'cleanup', updatedAt: '2026-09-28T08:00:00Z' }),
      ],
      lookedUp: [],
      linkedKeys,
    });
    return view.kind === 'list'
      ? view.rows.map((row) => ({ key: row.key, isLinked: row.isLinked }))
      : [];
  };

  it('keeps a task linked to the session and flags it', () => {
    expect(rowsOf(new Set(['revamp']))).toEqual([
      { key: 'revamp', isLinked: true },
      { key: 'cleanup', isLinked: false },
    ]);
  });

  it('flags nothing when no task is linked', () => {
    expect(rowsOf(new Set())).toEqual([
      { key: 'revamp', isLinked: false },
      { key: 'cleanup', isLinked: false },
    ]);
  });
});
