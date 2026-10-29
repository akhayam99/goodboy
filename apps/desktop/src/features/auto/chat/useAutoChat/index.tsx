import { useMemo } from 'react';
import type { Agent, Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';
import { autoTreeOfAgent, type AutoTreeOfAgent } from '../../autoTreeOfAgent';
import { useAutoTrees } from '../../useAutoTrees';
import { AutoDelegationLines } from '../AutoDelegationLines';
import { AutoPendingMessages } from '../AutoPendingMessages';
import { AutoProjectAsk } from '../AutoProjectAsk';
import { AutoTail } from '../AutoTail';
import { AutoWorkTime } from '../AutoWorkTime';
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
            <AutoDelegationLines
              sessionId={session.id}
              view={view}
              delegations={batch.delegations}
              agents={agents}
              onOpenChild={openChild}
              onOpenArtifact={openArtifact}
            />
          </AutoWorkTime>
        ),
      }),
    );
    const ask = projectAskOf({ view });
    const tail: TranscriptInsertion = {
      key: `auto-tail-${view.tree.id}`,
      beforeMs: null,
      node:
        ask === null ? (
          <AutoWorkTime session={session}>
            <AutoTail sessionId={session.id} view={view} rootAgent={agent} />
          </AutoWorkTime>
        ) : (
          <AutoProjectAsk sessionId={session.id} rootAgentId={agent.id} ask={ask} />
        ),
    };
    const pending: TranscriptInsertion = {
      key: `auto-pending-${view.tree.id}`,
      beforeMs: null,
      node: <AutoPendingMessages sessionId={session.id} view={view} />,
    };
    return [...lines, pending, tail];
  }, [view, agents, agent, openChild, openArtifact, session]);

  return {
    tree,
    insertions,
    composerPlaceholder: view === null ? undefined : composerPlaceholderOf({ view }),
  };
};
