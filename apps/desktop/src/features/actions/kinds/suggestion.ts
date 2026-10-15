import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { startTalkItThrough } from '../../auto/startTalkItThrough';
import { agentKindPalette, type AgentKind } from '../../session/agent-kind';
import { startRebaseTarget } from '../../suggestions/startRebaseTarget';
import type { RebaseSuggestionTarget, SessionSuggestion } from '../../suggestions/types';
import type { ActionDefinition, ObjectKindDefinition, SuggestionActionTarget } from '../types';

export const TALK_ACTION_ID = 'suggestion.talkWithAuto';

const TALK_IT_THROUGH_LABEL = 'Talk it through with Auto';

const MIN_REBASE_CHOICES = 2;

export type SuggestionFacts = {
  readonly sessionId: SessionId;
  readonly suggestion: SessionSuggestion;
  readonly startsRole: AgentKind | null;
  readonly isAutoOn: boolean;
};

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
    run: async ({ facts, env }) => {
      await env.getState().spawnAgent(facts.sessionId, { kindOverride: role, focus: 'none' });
    },
  };
};

type RebaseTargetsParams = {
  readonly suggestion: SessionSuggestion;
};

const rebaseTargetsOf = ({
  suggestion,
}: RebaseTargetsParams): ReadonlyArray<RebaseSuggestionTarget> => {
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

export const SUGGESTION_KIND: ObjectKindDefinition<SuggestionActionTarget, SuggestionFacts> = {
  noun: 'suggestion',
  facts: ({ target }) => ({
    sessionId: target.sessionId,
    suggestion: target.suggestion,
    startsRole: target.startsRole,
    isAutoOn: target.isAutoOn,
  }),
  adapted: ({ facts }) =>
    rebaseTargetsOf({ suggestion: facts.suggestion }).map((target) =>
      rebaseTargetAction({ target }),
    ),
  actions: [
    roleAlternative({
      id: 'suggestion.startTester',
      role: 'tester',
      label: 'Start tester instead',
      description: 'Writes tests for the changes',
    }),
    roleAlternative({
      id: 'suggestion.startImplementer',
      role: 'implementer',
      label: 'Start implementer instead',
      description: 'Makes the changes itself',
    }),
    {
      id: TALK_ACTION_ID,
      label: TALK_IT_THROUGH_LABEL,
      icon: CONCEPT_ICONS.auto,
      iconClassName: agentKindPalette({ kind: 'auto' }).fg,
      group: 'act',
      when: ({ facts }) => facts.isAutoOn && facts.startsRole !== null,
      run: ({ facts, env }) =>
        startTalkItThrough({
          state: env.getState(),
          sessionId: facts.sessionId,
          title: facts.suggestion.title,
          detail: facts.suggestion.detail ?? null,
        }),
    },
  ],
};
