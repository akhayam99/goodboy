import { useMemo } from 'react';
import type { Agent, Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';
import { autoTreeOfAgent, type AutoTreeOfAgent } from '../../autoTreeOfAgent';
import { useAutoTreeViews } from '../../useAutoTreeViews';
import { AutoWaitingStrip } from '../AutoWaitingStrip';
import { batchesOf } from '../batchesOf';
import { composerPlaceholderOf } from '../composerPlaceholderOf';
import { DelegationBatch } from '../DelegationBatch';
import { useAutoTreeActions } from '../useAutoTreeActions';
import { waitingTextOf } from '../waitingTextOf';
import type { ReactNode } from 'react';

type Params = {
  readonly session: Session;
  readonly agent: Agent;
};

export type AutoChat = Readonly<{
  tree: AutoTreeOfAgent | null;
  insertions: ReadonlyArray<TranscriptInsertion> | undefined;
  composerLead: ReactNode | undefined;
  composerPlaceholder: string | undefined;
}>;

export const useAutoChat = ({ session, agent }: Params): AutoChat => {
  const views = useAutoTreeViews({ sessionId: session.id });
  const agents = useAppStore((state) => state.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);
  const actions = useAutoTreeActions({ sessionId: session.id });
  const { openAgent, openArtifact } = actions;
  const tree = useMemo(() => autoTreeOfAgent({ views, agentId: agent.id }), [views, agent.id]);
  const view = tree?.kind === 'root' ? tree.view : null;

  const insertions = useMemo(
    () =>
      view === null
        ? undefined
        : batchesOf({ view }).map((batch): TranscriptInsertion => ({
            key: batch.key,
            beforeMs: batch.beforeMs,
            node: (
              <DelegationBatch
                view={view}
                delegations={batch.delegations}
                agents={agents}
                onOpenAgent={(card) => openAgent(card.childAgentId)}
                onOpenArtifact={openArtifact}
              />
            ),
          })),
    [view, agents, openAgent, openArtifact],
  );

  const isRootTurnRunning = useAppStore(
    (state) => state.agentTurnState[agent.id]?.kind === 'running',
  );
  const waitingText = view === null || isRootTurnRunning ? null : waitingTextOf({ view });
  const composerLead =
    view === null || waitingText === null ? undefined : (
      <AutoWaitingStrip
        text={waitingText}
        isStopping={actions.isStopping}
        onChangeApproach={() => void actions.changeApproach({ view })}
        onStop={() => void actions.stop({ view })}
      />
    );

  return {
    tree,
    insertions,
    composerLead,
    composerPlaceholder: view === null ? undefined : composerPlaceholderOf({ view }),
  };
};
