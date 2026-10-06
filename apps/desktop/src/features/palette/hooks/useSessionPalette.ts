import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, Session, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionOpenQuestions,
  useSessionStageInfo,
} from '../../../store';
import { usePendingAction } from '../../../shared/hooks/usePendingAction';
import { WORKFLOW_RUN_KIND, type WorkflowRunFacts } from '../../actions/kinds/workflowRun';
import type { AgentActionTarget, PullRequestActionTarget } from '../../actions/types';
import { openLens } from '../../session/openLens';
import { recordNextStepOutcome } from '../../suggestions/useNextStepOutcomes';
import { useSessionSuggestions } from '../../suggestions/useSessionSuggestions';
import { useSuggestionActions } from '../../suggestions/useSuggestionActions';
import { paletteTierOf, type PaletteTier } from '../paletteTiers';
import { pickLiveAgent } from '../sources/liveAgentEntries';
import { nextEntries, type NextItem } from '../sources/nextEntries';
import { pickRun, type PaletteRun } from '../sources/runEntries';
import type { PaletteEntry } from '../types';

type Params = {
  readonly session: Session;
};

type PaletteLiveAgent = {
  readonly target: AgentActionTarget;
  readonly name: string;
};

export type SessionPalette = {
  readonly sessionId: SessionId;
  readonly tier: PaletteTier;
  readonly next: ReadonlyArray<PaletteEntry>;
  readonly run: PaletteRun | null;
  readonly liveAgent: PaletteLiveAgent | null;
  readonly pullRequest: PullRequestActionTarget | null;
};

export const useSessionPalette = ({ session }: Params): SessionPalette => {
  const sessionId = session.id as SessionId;
  const agents = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY,
  ) as ReadonlyArray<Agent>;
  const turningIds = useAppStore(
    useShallow((s) =>
      agents.flatMap((agent) =>
        s.agentTurnState[agent.id]?.kind === 'running' ||
        s.agentTurnState[agent.id]?.kind === 'starting'
          ? [agent.id]
          : [],
      ),
    ),
  );
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[sessionId] ?? null);
  const focusedRunId = useAppStore((s) => s.focusedWorkflowRunId[sessionId] ?? null);
  const sessionWorkflows = useAppStore((s) => s.sessionWorkflows[sessionId] ?? EMPTY_ARRAY);
  const openQuestions = useSessionOpenQuestions(sessionId);
  const prNumber = useAppStore((s) => s.sessionGithub[sessionId]?.pr?.number ?? null);
  const stageInfo = useSessionStageInfo(session);
  const suggestions = useSessionSuggestions({ session, agents });
  const actionsFor = useSuggestionActions({
    session,
    agents,
    onSelectQuestions: () => openLens({ sessionId, lens: 'questions' }),
  });
  const pending = usePendingAction({ sessionId });

  const items = suggestions.map((suggestion): NextItem => ({
    suggestion,
    actions: actionsFor({ suggestion }),
  }));
  const next = nextEntries({
    items,
    execute: ({ suggestion, actions }) => {
      const primary = actions.primary;
      if (primary === null) {
        return;
      }
      void recordNextStepOutcome({
        sessionId,
        kind: suggestion.kind,
        outcome: 'accepted',
        fingerprint: suggestion.fingerprint,
      });
      void pending.run({
        key: suggestion.id,
        failureTitle: primary.failureTitle,
        task: primary.run,
      });
    },
  });

  const runFacts = useMemo(
    () =>
      session.workflowRuns.flatMap((run): ReadonlyArray<WorkflowRunFacts> => {
        const facts = WORKFLOW_RUN_KIND.facts({
          state: useAppStore.getState(),
          target: { kind: 'workflowRun', sessionId, runId: run.id },
        });
        return facts === null ? [] : [facts];
      }),
    [session.workflowRuns, sessionId, agents, openQuestions, turningIds, sessionWorkflows],
  );
  const picked = pickRun({ candidates: runFacts, focusedRunId });
  const run: PaletteRun | null =
    picked === null
      ? null
      : {
          facts: picked,
          target: { kind: 'workflowRun', sessionId, runId: picked.run.id },
        };

  const liveAgent = pickLiveAgent({
    agents,
    selectedAgentId,
    isTurnRunning: (agent) => agent.status === 'running' || turningIds.includes(agent.id),
  });

  return {
    sessionId,
    tier: paletteTierOf({
      isArchived: session.archivedAt != null,
      stage: stageInfo.stage,
      suggestionKinds: suggestions.map((suggestion) => suggestion.kind),
    }),
    next,
    run,
    liveAgent:
      liveAgent === null
        ? null
        : {
            target: { kind: 'agent', sessionId, agentId: liveAgent.id },
            name: liveAgent.name ?? 'agent',
          },
    pullRequest: prNumber === null ? null : { kind: 'pullRequest', sessionId, prNumber },
  };
};
