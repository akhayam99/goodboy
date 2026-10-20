import { brandId, type AgentId, type MountId, type ProjectId } from '@goodboy/types';
import {
  actionCardsOf,
  type ActionCardModel,
  type AutoActionTarget,
} from '../../../../../features/session/central/next/actionCardsOf';
import type {
  ActionCardActions,
  CardActions,
  CardVerb,
} from '../../../../../features/session/central/next/useActionCardActions';
import { foldSecondVerb } from '../../../../../features/session/central/next/foldSecondVerb';
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
  reason: 'Auto created it at 10:21, no first message reached it.',
  canRetry: true,
};

type MomentParams = {
  readonly moment: CentralNextMoment;
};

type LabelParams = {
  readonly label: string;
};

type CardParams = {
  readonly card: ActionCardModel;
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

const verbOf = ({ label }: LabelParams): CardVerb => ({
  label,
  ariaLabel: undefined,
  isDisabled: false,
  isBusy: false,
  confirmRole: null,
  hasPicker: false,
  run: () => undefined,
});

const SUGGESTION_VERB: Partial<Record<SessionSuggestion['kind'], string>> = {
  'fix-checks': 'Fix',
  'rebase-project': 'Rebase',
  'mark-ready': 'Mark ready',
};

const baseActionsOf = ({ card }: CardParams): CardActions => {
  const { source } = card;
  switch (source.kind) {
    case 'owner':
      return {
        main: verbOf({ label: 'Answer' }),
        second: null,
        failure: null,
        isBusy: false,
        agentKind: null,
        menu: null,
        foldedTarget: null,
      };
    case 'auto':
      return {
        main: { ...verbOf({ label: 'Retry' }), ariaLabel: `Retry "${source.target.role}"` },
        second: verbOf({ label: 'Open Auto' }),
        failure: null,
        isBusy: false,
        agentKind: null,
        menu: null,
        foldedTarget: null,
      };
    case 'suggestion':
      return {
        main: verbOf({ label: SUGGESTION_VERB[source.suggestion.kind] ?? 'Open' }),
        second: source.suggestion.kind === 'fix-checks' ? verbOf({ label: 'Open check' }) : null,
        failure: null,
        isBusy: false,
        agentKind: null,
        menu: {
          target: {
            kind: 'suggestion',
            sessionId: SESSION_ID,
            suggestion: source.suggestion,
            startsRole: null,
            isAutoOn: false,
            onNotNow: () => undefined,
          },
          pendingChoiceIds: new Set(),
          isHeld: false,
          isDisabled: false,
          trackChoice: ({ task }) => task(),
        },
        foldedTarget: null,
      };
    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
};

export const centralNextActionsFor: ActionCardActions['actionsFor'] = ({
  card,
  isNarrow = false,
}) => {
  const actions = baseActionsOf({ card });
  return isNarrow ? foldSecondVerb({ actions, sessionId: SESSION_ID }) : actions;
};
