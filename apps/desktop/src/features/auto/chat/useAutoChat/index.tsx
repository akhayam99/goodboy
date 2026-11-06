import { useMemo, type ReactNode } from 'react';
import type { Agent, Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';
import { autoTreeOfAgent, type AutoTreeOfAgent } from '../../autoTreeOfAgent';
import { isAutoPlanAwaitingApproval } from '../../isAutoPlanAwaitingApproval';
import { useAutoTrees } from '../../useAutoTrees';
import type { ConversationStop } from '../../../../shared/types/conversationStop';
import { approvedPlanLabelOf } from '../../plan/approvedPlanReply';
import { AutoDelegationLines } from '../AutoDelegationLines';
import { autoDockStopOf } from '../autoDockStopOf';
import { AutoDock } from '../AutoDock';
import { AutoTurnCard } from '../AutoTurnCard';
import { AutoWorkTime } from '../AutoWorkTime';
import { mountedLineOf } from '../mountedLineOf';
import { batchesOf } from '../batchesOf';
import { mergedBatchesOf } from '../mergedBatchesOf';
import { composerPlaceholderOf } from '../composerPlaceholderOf';
import { useAutoTreeActions } from '../useAutoTreeActions';

type Params = {
  readonly session: Session;
  readonly agent: Agent;
};

export type AutoChat = Readonly<{
  tree: AutoTreeOfAgent | null;
  insertions: ReadonlyArray<TranscriptInsertion> | undefined;
  dock: ReactNode | undefined;
  composerPlaceholder: string | undefined;
  stop: ConversationStop | null;
  isFailureOwned: boolean;
  isTreeAtRest: boolean;
}>;

const AT_REST: ReadonlySet<AutoTreeView['tree']['phase']> = new Set([
  'answering',
  'done',
  'finished',
]);

export const useAutoChat = ({ session, agent }: Params): AutoChat => {
  const views = useAutoTrees({ sessionId: session.id });
  const agents = useAppStore((state) => state.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);
  const rootTurn = useAppStore((state) => state.agentTurnState[agent.id] ?? null);
  const actions = useAutoTreeActions({ sessionId: session.id });
  const { openChild, openArtifact } = actions;
  const tree = useMemo(() => autoTreeOfAgent({ views, agentId: agent.id }), [views, agent.id]);
  const view = tree?.kind === 'root' ? tree.view : null;

  const insertions = useMemo(() => {
    if (view === null) {
      return undefined;
    }
    const lines = mergedBatchesOf({ batches: batchesOf({ view }) }).map(
      (batch): TranscriptInsertion => ({
        key: batch.key,
        beforeMs: batch.beforeMs,
        claimsReply: ({ text }) => approvedPlanLabelOf({ text }) !== null,
        node: ({ replies }) => (
          <AutoWorkTime session={session}>
            <AutoTurnCard delegations={batch.delegations} replies={replies}>
              <AutoDelegationLines
                sessionId={session.id}
                view={view}
                delegations={batch.delegations}
                agents={agents}
                onOpenChild={openChild}
              />
            </AutoTurnCard>
          </AutoWorkTime>
        ),
      }),
    );
    const tail: TranscriptInsertion = {
      key: `auto-tail-${view.tree.id}`,
      beforeMs: null,
      keptEchoIds: view.droppedMessageIds,
      node: null,
    };
    const mounted = mountedLineOf({ view });
    const mountedLine: ReadonlyArray<TranscriptInsertion> =
      mounted === null
        ? []
        : [
            {
              key: `auto-mounted-${view.tree.id}`,
              beforeMs: null,
              node: (
                <p data-auto-mounted className="text-ui text-muted-foreground">
                  {mounted}
                </p>
              ),
            },
          ];
    return [...lines, ...mountedLine, tail];
  }, [view, agents, openChild, session]);

  const stop =
    view === null
      ? null
      : autoDockStopOf({
          view,
          rootTurn,
          rootAgent: agent,
          isStopping: actions.isStopping,
          stop: () => void actions.stop({ view }),
        });

  const dock =
    view === null ? undefined : (
      <AutoDock
        sessionId={session.id}
        view={view}
        rootAgent={agent}
        onOpenArtifact={openArtifact}
        actions={actions}
        stop={stop}
      />
    );

  return {
    tree,
    insertions,
    dock,
    composerPlaceholder: view === null ? undefined : composerPlaceholderOf({ view }),
    stop,
    isFailureOwned: view?.tree.phase === 'blocked',
    isTreeAtRest:
      view !== null && AT_REST.has(view.tree.phase) && !isAutoPlanAwaitingApproval({ view }),
  };
};
