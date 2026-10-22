import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import type { SessionSuggestion } from '../../../suggestions/types';
import { suggestionPlaceOf } from './suggestionPlaceOf';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const ABOUT = brandId<MountId>({ value: 'mount-about' });

const BASE = {
  priority: 0,
  band: 1,
  sessionId: SESSION_ID,
  targetKey: null,
} as const;

const THREADS: SessionSuggestion = {
  ...BASE,
  id: 'resolve-threads',
  kind: 'resolve-threads',
  title: 'Fix review conversations',
  fingerprint: 'resolve-threads:4',
  payload: { eligibleThreadCount: 4 },
};

const QUESTIONS: SessionSuggestion = {
  ...BASE,
  id: 'answer-questions',
  kind: 'answer-questions',
  title: 'Answer open questions',
  fingerprint: 'answer-questions:2',
  payload: { count: 2, firstQuestion: null, rootAgentId: null },
};

const REBASE: SessionSuggestion = {
  ...BASE,
  id: 'rebase-project',
  kind: 'rebase-project',
  title: 'Rebase harbor-portal',
  fingerprint: 'rebase-project',
  payload: { targets: [] },
};

describe('suggestionPlaceOf', () => {
  it('opens review conversations on the branch comments and questions on the questions lens', () => {
    expect(suggestionPlaceOf({ suggestion: THREADS, mountId: ABOUT })).toEqual({
      kind: 'branch',
      mountId: ABOUT,
      tab: 'comments',
    });
    expect(suggestionPlaceOf({ suggestion: QUESTIONS, mountId: null })).toEqual({
      kind: 'questions',
    });
  });

  it('opens nothing for a card without a branch or one that spans several branches', () => {
    expect(suggestionPlaceOf({ suggestion: THREADS, mountId: null })).toBeNull();
    expect(suggestionPlaceOf({ suggestion: REBASE, mountId: ABOUT })).toBeNull();
  });
});
