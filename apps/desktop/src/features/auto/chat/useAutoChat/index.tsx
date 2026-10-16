import { useMemo } from 'react';
import type { Agent, Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';
import { autoTreeOfAgent, type AutoTreeOfAgent } from '../../autoTreeOfAgent';
import { useAutoTreeViews } from '../../useAutoTreeViews';
import { AutoDelegationLines } from '../AutoDelegationLines';
import { AutoProjectAsk } from '../AutoProjectAsk';
import { AutoTail } from '../AutoTail';
import { projectAskOf } from '../projectAskOf';
import { batchesOf } from '../batchesOf';
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
  const views = useAutoTreeViews({ sessionId: session.id });
  const agents = useAppStore((state) => state.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);
  const { openChild, openArtifact } = useAutoTreeActions({ sessionId: session.id });
  const tree = useMemo(() => autoTreeOfAgent({ views, agentId: agent.id }), [views, agent.id]);
  const view = tree?.kind === 'root' ? tree.view : null;

  const insertions = useMemo(() => {
    if (view === null) {
      return undefined;
    }
    const lines = batchesOf({ view }).map((batch): TranscriptInsertion => ({
      key: batch.key,
      beforeMs: batch.beforeMs,
      node: (
        <AutoDelegationLines
          sessionId={session.id}
          view={view}
          delegations={batch.delegations}
          agents={agents}
          onOpenChild={openChild}
          onOpenArtifact={openArtifact}
        />
      ),
    }));
    const ask = projectAskOf({ view });
    const tail: TranscriptInsertion = {
      key: `auto-tail-${view.tree.id}`,
      beforeMs: null,
      node:
        ask === null ? (
          <AutoTail sessionId={session.id} view={view} rootAgent={agent} />
        ) : (
          <AutoProjectAsk sessionId={session.id} rootAgentId={agent.id} ask={ask} />
        ),
    };
    return [...lines, tail];
  }, [view, agents, agent, openChild, openArtifact, session.id]);

  return {
    tree,
    insertions,
    composerPlaceholder: view === null ? undefined : composerPlaceholderOf({ view }),
  };
};
