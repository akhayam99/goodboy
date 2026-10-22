import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { startTalkItThrough } from '../../auto/startTalkItThrough';
import { continueWithRole } from '../../session/startRun/continueWithRole';
import { agentKindPalette, type AgentKind } from '../../session/agent-kind';
import { commitsAheadLabel } from '../../suggestions/commitsAheadLabel';
import { startRebaseTarget } from '../../suggestions/startRebaseTarget';
import type {
  OpenPrTarget,
  RebaseSuggestionTarget,
  SessionSuggestion,
} from '../../suggestions/types';
import { branchPlace } from '../../../store/slices/navigation/place';
import type {
  ActionDefinition,
  FoldedVerb,
  ObjectKindDefinition,
  SuggestionActionTarget,
} from '../types';
import { foldedVerbActions } from './actionCard';

export const TALK_ACTION_ID = 'suggestion.talkWithAuto';

const TALK_IT_THROUGH_LABEL = 'Talk it through with Auto';

const MIN_REBASE_CHOICES = 2;

const MIN_OPEN_PR_CHOICES = 2;

export type SuggestionFacts = {
  readonly sessionId: SessionId;
  readonly suggestion: SessionSuggestion;
  readonly startsRole: AgentKind | null;
  readonly isAutoOn: boolean;
  readonly onNotNow: (() => void) | null;
  readonly foldedVerbs: ReadonlyArray<FoldedVerb>;
};

const NO_VERBS: ReadonlyArray<FoldedVerb> = [];

export const NOT_NOW_ACTION_ID = 'suggestion.notNow';

type RoleAlternativeParams = {
  readonly id: string;
  readonly role: AgentKind;
  readonly label: string;
  readonly description: string;
};

const roleAlternative = ({
  id,
  role,
  label,
  description,
}: RoleAlternativeParams): ActionDefinition<SuggestionFacts> => {
  const palette = agentKindPalette({ kind: role });
  return {
    id,
    label,
    icon: palette.icon,
    iconClassName: palette.fg,
    group: 'act',
    description: () => description,
    preview: () => ({ kind: 'role', agentKind: role }),
    when: ({ facts }) => facts.suggestion.kind === 'check-changes',
    run: async ({ facts }) => {
      await continueWithRole({
        sessionId: facts.sessionId,
        role,
        work: description,
        sourceAgentId: null,
      });
    },
  };
};

type SuggestionParams = {
  readonly suggestion: SessionSuggestion;
};

const rebaseTargetsOf = ({
  suggestion,
}: SuggestionParams): ReadonlyArray<RebaseSuggestionTarget> => {
  if (suggestion.kind !== 'rebase-project') {
    return [];
  }
  return suggestion.payload.targets.length >= MIN_REBASE_CHOICES ? suggestion.payload.targets : [];
};

type RebaseTargetActionParams = {
  readonly target: RebaseSuggestionTarget;
};

const rebaseTargetAction = ({
  target,
}: RebaseTargetActionParams): ActionDefinition<SuggestionFacts> => ({
  id: `suggestion.rebase.${target.id}`,
  label: target.projectName,
  icon: CONCEPT_ICONS.branch,
  group: 'act',
  description: () => `${target.branch}, ${target.behind} behind`,
  when: () => true,
  run: ({ facts, env }) =>
    startRebaseTarget({
      openRewriteHistory: env.getState().openRewriteHistory,
      sessionId: facts.sessionId,
      target,
    }),
});

const openPrTargetsOf = ({ suggestion }: SuggestionParams): ReadonlyArray<OpenPrTarget> => {
  if (suggestion.kind !== 'open-pr') {
    return [];
  }
  return suggestion.payload.targets.length >= MIN_OPEN_PR_CHOICES ? suggestion.payload.targets : [];
};

type OpenPrTargetActionParams = {
  readonly target: OpenPrTarget;
};

const openPrTargetAction = ({
  target,
}: OpenPrTargetActionParams): ActionDefinition<SuggestionFacts> => ({
  id: `suggestion.openPr.${target.mountId}`,
  label: target.branch,
  icon: CONCEPT_ICONS.branch,
  group: 'act',
  description: () => `${target.projectName}, ${commitsAheadLabel({ ahead: target.ahead })}`,
  when: () => true,
  run: async ({ facts, env }) => {
    env.getState().navigate({
      to: branchPlace({ sessionId: facts.sessionId, mountPath: target.worktreePath, tab: 'pr' }),
    });
  },
});

export const SUGGESTION_KIND: ObjectKindDefinition<SuggestionActionTarget, SuggestionFacts> = {
  noun: 'suggestion',
  facts: ({ target }) => ({
    sessionId: target.sessionId,
    suggestion: target.suggestion,
    startsRole: target.startsRole,
    isAutoOn: target.isAutoOn,
    onNotNow: target.onNotNow ?? null,
    foldedVerbs: target.foldedVerbs ?? NO_VERBS,
  }),
  adapted: ({ facts }) => [
    ...foldedVerbActions<SuggestionFacts>({ verbs: facts.foldedVerbs, kind: 'suggestion' }),
    ...rebaseTargetsOf({ suggestion: facts.suggestion }).map((target) =>
      rebaseTargetAction({ target }),
    ),
    ...openPrTargetsOf({ suggestion: facts.suggestion }).map((target) =>
      openPrTargetAction({ target }),
    ),
  ],
  actions: [
    roleAlternative({
      id: 'suggestion.startTester',
      role: 'tester',
      label: 'Continue with Tester',
      description: 'Writes tests for the changes',
    }),
    roleAlternative({
      id: 'suggestion.startImplementer',
      role: 'implementer',
      label: 'Continue with Implementer',
      description: 'Makes the changes itself',
    }),
    {
      id: TALK_ACTION_ID,
      label: TALK_IT_THROUGH_LABEL,
      icon: CONCEPT_ICONS.auto,
      iconClassName: agentKindPalette({ kind: 'auto' }).fg,
      group: 'act',
      when: ({ facts }) => facts.isAutoOn && facts.startsRole !== null,
      run: ({ facts }) =>
        startTalkItThrough({
          sessionId: facts.sessionId,
          title: facts.suggestion.title,
          detail: facts.suggestion.detail ?? null,
        }),
    },
    {
      id: NOT_NOW_ACTION_ID,
      label: 'Not now',
      icon: CONCEPT_ICONS.archive,
      group: 'act',
      when: ({ facts }) => facts.onNotNow !== null,
      run: ({ facts }) => facts.onNotNow?.(),
    },
  ],
};
