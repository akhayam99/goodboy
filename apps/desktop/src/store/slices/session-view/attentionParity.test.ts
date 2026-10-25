// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PullRequestState, SessionAttentionReason } from '@goodboy/types';
import { aSession, TEST_NOW } from '@goodboy/types/testing';
import { ATTENTION_REASON_META } from '../../../features/session/session-stage';
import { isErrorReason, isHumanInputReason } from './attentionFactsOf';
import { attentionCountOf } from './attentionCountOf';
import { attentionReasonsOf } from './attentionReasonsOf';
import { deriveSessionStage } from './deriveSessionStage';

type ParityCase = {
  readonly name: string;
  readonly session: {
    readonly isErrored: boolean;
    readonly isLive: boolean;
    readonly isBranchless: boolean;
  };
  readonly facts: {
    readonly openQuestions: number;
    readonly fixNeedsYou: number;
    readonly pushFailed: number;
    readonly isCiFailing: boolean;
  };
  readonly isCounted: boolean;
  readonly tone: 'danger' | 'warning' | null;
  readonly reasons: ReadonlyArray<SessionAttentionReason>;
};

type ParityReason = {
  readonly reason: SessionAttentionReason;
  readonly tone: 'danger' | 'warning';
  readonly kind: 'error' | 'human-input' | 'other';
};

type Parity = {
  readonly reasons: ReadonlyArray<ParityReason>;
  readonly cases: ReadonlyArray<ParityCase>;
};

const parity: Parity = JSON.parse(
  readFileSync(new URL('../../../../src-tauri/src/attention/parity.json', import.meta.url), 'utf8'),
);

const failingPr: PullRequestState = {
  number: 7,
  title: 'Ship the ledger sync',
  url: 'https://example.test/7',
  state: 'open',
  mergeable: true,
  checks: 'failure',
  baseBranch: 'main',
  headBranch: 'ak/feat',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: TEST_NOW,
};

type CaseParams = {
  readonly parityCase: ParityCase;
};

const infoOf = ({ parityCase }: CaseParams) =>
  deriveSessionStage({
    session: aSession({
      goal: 'Ship the ledger sync',
      state: parityCase.session.isErrored
        ? { kind: 'error', message: 'The agent stopped', failedAt: TEST_NOW }
        : { kind: 'idle', lastActivityAt: TEST_NOW },
    }),
    pr: parityCase.facts.isCiFailing ? failingPr : null,
    hasUnread: false,
    openQuestionCount: parityCase.facts.openQuestions,
    fixNeedsYouCount: parityCase.facts.fixNeedsYou,
    pushFailedCount: parityCase.facts.pushFailed,
    hasRunningAgent: parityCase.session.isLive,
    isBranchless: parityCase.session.isBranchless,
    prFetchState: 'known',
  });

describe('the Rust workspace count and attentionCountOf', () => {
  it('give every reason Rust counts the tone and the kind the registry gives it', () => {
    for (const { reason, tone, kind } of parity.reasons) {
      expect(ATTENTION_REASON_META[reason].tone, reason).toBe(tone);
      expect(isErrorReason({ reason }), reason).toBe(kind === 'error');
      expect(isHumanInputReason({ reason }), reason).toBe(kind === 'human-input');
    }
  });

  it.each(parity.cases.map((parityCase) => [parityCase.name, parityCase] as const))(
    'agree on: %s',
    (_name, parityCase) => {
      const info = infoOf({ parityCase });
      const counted = attentionCountOf({ items: [{ id: 'session-1', info }] });

      expect(counted.count).toBe(parityCase.isCounted ? 1 : 0);
      expect(counted.tone).toBe(parityCase.tone);
      if (!parityCase.isCounted) {
        return;
      }
      const known = new Set(parity.reasons.map((entry) => entry.reason));
      expect(attentionReasonsOf({ info }).filter((reason) => known.has(reason))).toEqual(
        parityCase.reasons,
      );
    },
  );
});
