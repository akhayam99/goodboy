import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bitbucketPrStateKind } from '../bitbucketPullRequestFacts';
import { gitlabStateKindOf } from '../gitlabPullRequestPort';
import { REQUEST_STATE_KIND, requestStateKind } from '../requestStateKind';

const REQUEST_STATE_RS = new URL(
  '../../../../../apps/desktop/src-tauri/src/integrations/request_state.rs',
  import.meta.url,
);

const rustVariants = (): ReadonlyArray<string> => {
  const source = readFileSync(REQUEST_STATE_RS, 'utf8');
  const body = /pub\(crate\) enum RequestState \{([^}]*)\}/.exec(source)?.[1] ?? '';
  return body
    .split('\n')
    .map((line) => line.replace('#[default]', '').replace(',', '').trim())
    .filter((line) => /^[A-Z][A-Za-z]*$/.test(line))
    .map((line) => line.toLowerCase());
};

describe('request state', () => {
  it('names exactly the states Rust serializes', () => {
    expect(Object.keys(REQUEST_STATE_KIND).sort()).toEqual([...rustVariants()].sort());
  });

  it.each([
    ['open', 'open'],
    ['merged', 'merged'],
    ['closed', 'closed'],
    ['draft', 'draft'],
    ['unknown', 'open'],
  ] as const)('reads the request state %s as the kind %s', (requestState, kind) => {
    expect(requestStateKind({ requestState })).toBe(kind);
  });

  it('prefers the state Rust mapped over the raw Bitbucket string', () => {
    expect(bitbucketPrStateKind({ state: 'OPEN', requestState: 'merged' })).toBe('merged');
    expect(bitbucketPrStateKind({ state: 'SUPERSEDED', requestState: 'closed' })).toBe('closed');
    expect(bitbucketPrStateKind({ state: 'FUTURE', requestState: 'unknown' })).toBe('open');
  });

  it('keeps reading the raw Bitbucket string when Rust sent no state', () => {
    expect(bitbucketPrStateKind({ state: 'DECLINED' })).toBe('closed');
    expect(bitbucketPrStateKind({ state: 'MERGED' })).toBe('merged');
  });

  it('settles a GitLab merged or closed request from the state Rust mapped', () => {
    expect(gitlabStateKindOf({ state: 'opened', draft: false, requestState: 'merged' })).toBe(
      'merged',
    );
    expect(gitlabStateKindOf({ state: 'opened', draft: false, requestState: 'closed' })).toBe(
      'closed',
    );
  });

  it('keeps queued and draft on the raw GitLab fields', () => {
    expect(
      gitlabStateKindOf({
        state: 'opened',
        draft: false,
        isMergeWhenPipelineSucceeds: true,
        requestState: 'open',
      }),
    ).toBe('queued');
    expect(gitlabStateKindOf({ state: 'opened', draft: true, requestState: 'draft' })).toBe(
      'draft',
    );
    expect(gitlabStateKindOf({ state: 'archived', draft: false, requestState: 'unknown' })).toBe(
      'open',
    );
  });
});
