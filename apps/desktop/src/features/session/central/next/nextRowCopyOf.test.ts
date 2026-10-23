import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type MountId, type SessionId } from '@goodboy/types';
import type { SessionSuggestion } from '../../../suggestions/types';
import { actionCardsOf, type AutoActionTarget } from './actionCardsOf';
import { nextRowCopyOf } from './nextRowCopyOf';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const HOME = brandId<MountId>({ value: 'mount-home' });
const HOME_BRANCH = { branch: 'hl/feat-center-home-page', request: '#9995' };

const BLOCKED: AutoActionTarget = {
  agentId: brandId<AgentId>({ value: 'agent-home-implementer' }),
  rootAgentId: brandId<AgentId>({ value: 'agent-auto-rollout' }),
  role: 'Build the hero',
  noun: 'Implementer',
  kind: 'childBlocked',
  reason: 'Non riesco a chiudere.',
  reasonCode: 'declared_blocked',
  mountId: HOME,
  plan: null,
  canRetry: true,
};

const THREADS: SessionSuggestion = {
  id: `resolve-threads:${SESSION_ID}`,
  kind: 'resolve-threads',
  priority: 30,
  band: 1,
  title: 'Fix review conversations',
  detail: '4 conversations',
  sessionId: SESSION_ID,
  fingerprint: `resolve-threads:${SESSION_ID}:4`,
  targetKey: `pr:${HOME}`,
  payload: { eligibleThreadCount: 4 },
};

type SourcesParams = {
  readonly autoTargets?: ReadonlyArray<AutoActionTarget>;
  readonly suggestions?: ReadonlyArray<SessionSuggestion>;
};

const firstOf = ({ autoTargets = [], suggestions = [] }: SourcesParams) => {
  const [card] = actionCardsOf({ owners: [], suggestions, autoTargets });
  if (card === undefined) {
    throw new Error('no card');
  }
  return card;
};

describe('nextRowCopyOf', () => {
  it('titles a Fix row by its branch and pull request, with the human sentence under it', () => {
    const row = nextRowCopyOf({
      row: firstOf({ autoTargets: [BLOCKED] }),
      group: 'fix',
      branch: HOME_BRANCH,
    });

    expect([row.title, row.detail]).toEqual([
      'hl/feat-center-home-page · #9995',
      'The implementer is blocked.',
    ]);
  });

  it('says review conversations as a sentence and drops the number when no request is open', () => {
    const row = nextRowCopyOf({
      row: firstOf({ suggestions: [THREADS] }),
      group: 'fix',
      branch: { branch: 'hl/feat-center-about-page', request: null },
    });

    expect([row.title, row.detail]).toEqual([
      'hl/feat-center-about-page',
      '4 review conversations wait for a fix.',
    ]);
  });

  it('keeps the row as it is outside Fix or without a known branch', () => {
    const row = firstOf({ autoTargets: [BLOCKED] });

    expect(nextRowCopyOf({ row, group: 'ship', branch: HOME_BRANCH })).toBe(row);
    expect(nextRowCopyOf({ row, group: 'fix', branch: null })).toBe(row);
  });

  it('titles a stopped rebase in Update by its branch, with the sentence of the stop', () => {
    const [stop] = actionCardsOf({
      owners: [
        {
          id: 'event:ev-home-stop',
          kind: 'rebase',
          text: 'Rebase of hl/feat-center-home-page stopped · conflict in HomePage.tsx',
          where: null,
          at: '2026-10-22T10:00:00.000Z',
          item: null,
          question: null,
          questionIds: [],
          prNumber: null,
          owed: null,
          mountId: HOME,
        },
      ],
      suggestions: [],
      autoTargets: [],
    });
    if (stop === undefined) {
      throw new Error('no stop row');
    }

    const row = nextRowCopyOf({
      row: stop,
      group: 'update',
      branch: HOME_BRANCH,
      stopLine: '1 file conflicts with main: HomePage.tsx. Your branch is as it was.',
    });

    expect([row.title, row.detail]).toEqual([
      'hl/feat-center-home-page · #9995',
      '1 file conflicts with main: HomePage.tsx. Your branch is as it was.',
    ]);
    expect(nextRowCopyOf({ row: stop, group: 'update', branch: HOME_BRANCH })).toBe(stop);
  });
});
