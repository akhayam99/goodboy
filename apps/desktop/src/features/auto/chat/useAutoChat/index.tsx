import { useMemo, type ReactNode } from 'react';
import type { Agent, Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';
import { autoTreeOfAgent, type AutoTreeOfAgent } from '../../autoTreeOfAgent';
import { useAutoTrees } from '../../useAutoTrees';
import { AutoDelegationLines } from '../AutoDelegationLines';
import { AutoDock } from '../AutoDock';
import { AutoProjectAsk } from '../AutoProjectAsk';
import { AutoTail } from '../AutoTail';
import { AutoTurnCard } from '../AutoTurnCard';
import { AutoWorkTime } from '../AutoWorkTime';
import { mountedLineOf } from '../mountedLineOf';
import { projectAskOf } from '../projectAskOf';
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
}>;

export const useAutoChat = ({ session, agent }: Params): AutoChat => {
  const views = useAutoTrees({ sessionId: session.id });
  const agents = useAppStore((state) => state.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);
  const { openChild, openArtifact } = useAutoTreeActions({ sessionId: session.id });
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
        node: (
          <AutoWorkTime session={session}>
            <AutoTurnCard delegations={batch.delegations}>
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
    const ask = projectAskOf({ view });
    const tail: TranscriptInsertion = {
      key: `auto-tail-${view.tree.id}`,
      beforeMs: null,
      keptEchoIds: view.droppedMessageIds,
      node:
        ask === null ? (
          <AutoWorkTime session={session}>
            <AutoTail sessionId={session.id} view={view} rootAgent={agent} />
          </AutoWorkTime>
        ) : (
          <AutoProjectAsk sessionId={session.id} rootAgentId={agent.id} ask={ask} />
        ),
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
  }, [view, agents, agent, openChild, openArtifact, session]);

  const dock =
    view === null ? undefined : (
      <AutoDock
        sessionId={session.id}
        view={view}
        rootAgent={agent}
        onOpenArtifact={openArtifact}
      />
    );

  return {
    tree,
    insertions,
    dock,
    composerPlaceholder: view === null ? undefined : composerPlaceholderOf({ view }),
  };
};
