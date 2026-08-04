import { describe, expect, it } from 'vitest';
import type { IsoDateTime, SessionExternalTask, SessionId } from '@goodboy/types';
import { closingIssueReferences } from './closingIssueReferences';
import { appendClosingReferences } from './appendClosingReferences';

const NOW = '2026-08-04T00:00:00.000Z' as IsoDateTime;

const task = (overrides: Partial<SessionExternalTask>): SessionExternalTask => ({
  sessionId: 'sess-1' as SessionId,
  provider: 'github',
  externalId: '41',
  identifier: '#41',
  url: 'https://github.com/acme/web/issues/41',
  title: 'Broken card',
  createdAt: NOW,
  ...overrides,
});

describe('closingIssueReferences', () => {
  it('references a github issue linked on the current branch', () => {
    const refs = closingIssueReferences({
      tasks: [task({ branch: 'ak/cards' })],
      branch: 'ak/cards',
      body: '',
    });
    expect(refs.map((ref) => ref.line)).toEqual(['Closes #41']);
  });

  it('skips a github issue linked on another branch', () => {
    const refs = closingIssueReferences({
      tasks: [task({ branch: 'ak/other' })],
      branch: 'ak/cards',
      body: '',
    });
    expect(refs).toEqual([]);
  });

  it('never writes a non-github issue as a closing reference', () => {
    const refs = closingIssueReferences({
      tasks: [
        task({
          provider: 'linear',
          externalId: 'GRO-12',
          identifier: 'GRO-12',
          branch: 'ak/cards',
        }),
        task({ provider: 'sentry', externalId: '99', identifier: 'SENTRY-99', branch: 'ak/cards' }),
        task({ provider: 'gitlab', externalId: '7', identifier: '!7', branch: 'ak/cards' }),
      ],
      branch: 'ak/cards',
      body: '',
    });
    expect(refs).toEqual([]);
  });

  it('sorts and dedupes several linked issues, and keeps the ones without a branch', () => {
    const refs = closingIssueReferences({
      tasks: [
        task({ externalId: '52', identifier: '#52', branch: 'ak/cards' }),
        task({ externalId: '41', identifier: '#41' }),
        task({ externalId: '41', identifier: '#41', branch: 'ak/cards' }),
      ],
      branch: 'ak/cards',
      body: '',
    });
    expect(refs.map((ref) => ref.line)).toEqual(['Closes #41', 'Closes #52']);
  });

  it('does not repeat a reference the body already closes', () => {
    const refs = closingIssueReferences({
      tasks: [task({ branch: 'ak/cards' }), task({ externalId: '52', identifier: '#52' })],
      branch: 'ak/cards',
      body: 'Fixes #41 in the card renderer.',
    });
    expect(refs.map((ref) => ref.line)).toEqual(['Closes #52']);
  });
});

describe('appendClosingReferences', () => {
  it('appends the reference block after the body', () => {
    const references = closingIssueReferences({
      tasks: [task({ branch: 'ak/cards' })],
      branch: 'ak/cards',
      body: 'Documents the change.',
    });
    expect(appendClosingReferences({ body: 'Documents the change.', references })).toBe(
      'Documents the change.\n\nCloses #41',
    );
  });

  it('leaves the body untouched when nothing is referenced', () => {
    expect(appendClosingReferences({ body: 'Documents the change.', references: [] })).toBe(
      'Documents the change.',
    );
  });
});
