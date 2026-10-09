import { describe, expect, it } from 'vitest';
import type { LensKind } from '../../../../store';
import { pagesOf, type Page } from '../../../session/pageRegistry';
import { currentSignOf } from './currentSign';

const ALL_LENSES: ReadonlyArray<LensKind | null> = [
  null,
  'branch',
  'review',
  'pr',
  'files',
  'workflows',
  'agents',
  'plans',
  'questions',
  'explore',
  'scripts',
  'terminal',
  'linear',
  'gitlab_issues',
  'jira_issues',
  'slack_threads',
  'context',
  'goal',
  'decisions',
  'last_output_summary',
  'github_issue',
];

const cardPages = (hasOpenQuestions: boolean): ReadonlyArray<Page> =>
  pagesOf({
    isBranchless: false,
    destinations: [{ lens: 'questions', shortcut: 'lens.questions' }],
    hasOpenQuestions,
  });

const NO_PAGES: ReadonlyArray<Page> = [];

const SHOWN_VARIANTS = [
  { name: 'pages shown, questions open', pages: cardPages(true) },
  { name: 'pages shown, nothing open', pages: cardPages(false) },
  { name: 'pages folded', pages: NO_PAGES },
];

describe('currentSignOf', () => {
  it.each(SHOWN_VARIANTS)('carries exactly one sign for every lens: $name', ({ pages }) => {
    for (const activeLens of ALL_LENSES) {
      for (const hasStudioOver of [false, true]) {
        const sign = currentSignOf({ activeLens, pages, hasStudioOver });
        const marked = [
          ...pages.filter((page) => page.id === sign).map((page) => page.id),
          ...(sign === 'session' || sign === 'remembered' ? ['session-row'] : []),
        ];
        expect(marked).toHaveLength(1);
      }
    }
  });

  it('marks the page row whose lens is open', () => {
    const pages = cardPages(true);
    expect(currentSignOf({ activeLens: null, pages, hasStudioOver: false })).toBe('overview');
    expect(currentSignOf({ activeLens: 'workflows', pages, hasStudioOver: false })).toBe('runs');
    expect(currentSignOf({ activeLens: 'files', pages, hasStudioOver: false })).toBe('branch');
    expect(currentSignOf({ activeLens: 'pr', pages, hasStudioOver: false })).toBe('branch');
    expect(currentSignOf({ activeLens: 'questions', pages, hasStudioOver: false })).toBe(
      'questions',
    );
  });

  it('marks the session row on the Tools lenses and linked records', () => {
    const pages = cardPages(true);
    for (const activeLens of [
      'terminal',
      'scripts',
      'explore',
      'linear',
      'slack_threads',
    ] as const) {
      expect(currentSignOf({ activeLens, pages, hasStudioOver: false })).toBe('session');
    }
  });

  it('marks the session row on Questions when nothing is open', () => {
    expect(
      currentSignOf({ activeLens: 'questions', pages: cardPages(false), hasStudioOver: false }),
    ).toBe('session');
  });

  it('marks the session row when the pages are folded', () => {
    expect(currentSignOf({ activeLens: 'agents', pages: NO_PAGES, hasStudioOver: false })).toBe(
      'session',
    );
  });

  it('remembers the session while a studio sits over it', () => {
    expect(
      currentSignOf({ activeLens: 'agents', pages: cardPages(true), hasStudioOver: true }),
    ).toBe('remembered');
  });
});
