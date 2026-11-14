import { brandId, type AgentId, type MountId, type ProjectId } from '@goodboy/types';
import {
  actionCardsOf,
  type ActionCardModel,
  type AutoActionTarget,
} from '../../../../../features/session/central/next/actionCardsOf';
import type { NeedsYouOwner } from '../../../../../features/session/timeline/needsYou';
import type { SessionSuggestion } from '../../../../../features/suggestions/types';
import { SESSION_ID } from '../resolveSeed';

export type CentralNextMoment = 'mid' | 'stuck' | 'done';

const MOUNT_ID = brandId<MountId>({ value: 'mock-central-mount-payments-api' });
const PROJECT_ID = brandId<ProjectId>({ value: 'mock-central-project-payments-api' });
const FIXER_ID = brandId<AgentId>({ value: 'mock-central-agent-fixer' });
const AUTO_ID = brandId<AgentId>({ value: 'mock-central-agent-auto' });

const QUESTION_OWNER: NeedsYouOwner = {
  id: 'mock-central-question',
  kind: 'question',
  text: 'Cap per day or per payout?',
  where: 'Build step 4 waits on it',
  at: '2026-10-18T10:30:00.000Z',
  item: null,
  question: null,
  questionIds: ['mock-central-question'],
  prNumber: null,
  owed: null,
  mountId: null,
};

const FIX_CHECKS: SessionSuggestion = {
  id: 'fix-checks:mock-central',
  kind: 'fix-checks',
  priority: 20,
  band: 1,
  title: 'Fix the failing static-analysis check',
  detail: 'payments-api #309',
  sessionId: SESSION_ID,
  fingerprint: 'fix-checks:mock-central',
  targetKey: `pr:${MOUNT_ID}`,
  payload: { mountId: MOUNT_ID, projectName: 'payments-api', prNumber: 309 },
};

const REBASE: SessionSuggestion = {
  id: 'rebase-project:mock-central',
  kind: 'rebase-project',
  priority: 40,
  band: 2,
  title: 'Rebase payments-api on main',
  detail: '6 behind main',
  sessionId: SESSION_ID,
  fingerprint: 'rebase-project:mock-central',
  targetKey: null,
  payload: {
    targets: [
      {
        id: `mount:${MOUNT_ID}`,
        mountId: MOUNT_ID,
        projectId: PROJECT_ID,
        projectName: 'payments-api',
        branch: 'acme/tenant-limits',
        worktreePath: '/mock/payments-api',
        baseBranch: 'main',
        behind: 6,
        dirtyCount: 0,
      },
    ],
  },
};

const MARK_READY: SessionSuggestion = {
  id: 'mark-ready:mock-central',
  kind: 'mark-ready',
  priority: 30,
  band: 2,
  title: 'Mark #309 ready for review',
  detail: 'All checks passed on payments-api',
  sessionId: SESSION_ID,
  fingerprint: 'mark-ready:mock-central',
  targetKey: `pr:${MOUNT_ID}`,
  payload: { mountId: MOUNT_ID, projectName: 'payments-api', prNumber: 309 },
};

const FIXER_NEVER_STARTED: AutoActionTarget = {
  agentId: FIXER_ID,
  rootAgentId: AUTO_ID,
  role: 'Fixer',
  kind: 'neverStarted',
  noun: 'Fixer',
  reason: 'Auto created it at 10:21, no first message reached it.',
  reasonCode: null,
  mountId: null,
  plan: null,
  canRetry: true,
};

type MomentParams = {
  readonly moment: CentralNextMoment;
};

export const centralNextCards = ({ moment }: MomentParams): ReadonlyArray<ActionCardModel> => {
  switch (moment) {
    case 'mid':
      return actionCardsOf({
        owners: [QUESTION_OWNER],
        suggestions: [FIX_CHECKS, REBASE],
        autoTargets: [],
      });
    case 'stuck':
      return actionCardsOf({
        owners: [],
        suggestions: [REBASE],
        autoTargets: [FIXER_NEVER_STARTED],
      });
    case 'done':
      return actionCardsOf({ owners: [], suggestions: [MARK_READY], autoTargets: [] });
    default: {
      const exhaustive: never = moment;
      return exhaustive;
    }
  }
};
