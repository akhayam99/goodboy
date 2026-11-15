import { useMemo } from 'react';
import type { AutoDelegation } from '@goodboy/db';
import type { Agent, AgentId, SessionId, TelemetryRecord } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { AgentQueuedTurn } from '../../../../store/slices/agentQueue/types';
import type { AutoReadMessage } from '../../../../store/slices/auto-view/state';
import { useIsWorkOn } from '../../../../shared/hooks/useIsWorkOn';
import { useSessionRunHistory } from '../../../../shared/hooks/useSessionRunHistory';
import { agentSpendById } from '../../../session/timeline/agentSpendById';
import { autoTreeOfAgent } from '../../autoTreeOfAgent';
import { autoTreeWordOf } from '../../autoTreeWordOf';
import type { LeadTreeRootState } from '../../tree/leadTreeRootState';
import { leadTreeDelegationsOf } from '../../tree/leadTreeDelegationsOf';
import { leadTreeItemsOf, type LeadTreeItem } from '../../tree/leadTreeItemsOf';
import { leadTreeOf, type LeadTree } from '../../tree/leadTreeOf';
import { noteNodesOf, type NoteSource } from '../../tree/noteNodesOf';
import { useAutoTreeViews } from '../../useAutoTreeViews';

type Params = {
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
  readonly queue: ReadonlyArray<AgentQueuedTurn>;
  readonly queued: Readonly<{
    rows: ReadonlyArray<NoteSource>;
    onEdit: (id: string) => void;
    onRemove: (id: string) => void;
  }>;
};

export type LeadTreeModel = Readonly<{
  items: ReadonlyArray<LeadTreeItem>;
  root: LeadTreeRootState | null;
  tree: LeadTree | null;
  delegations: ReadonlyArray<AutoDelegation>;
  launchSnapshots: Readonly<Record<string, unknown>>;
  onEditNote: (noteId: string) => void;
  onRemoveNote: (noteId: string) => void;
}>;

const NO_ITEMS: ReadonlyArray<LeadTreeItem> = [];

const NO_FOLDS: ReadonlySet<string> = new Set();

const NO_AGENTS: ReadonlyArray<Agent> = [];

const NO_DELEGATIONS: ReadonlyArray<AutoDelegation> = [];

const NO_TELEMETRY: ReadonlyArray<TelemetryRecord> = [];

const NO_READ: ReadonlyArray<AutoReadMessage> = [];

const NO_SNAPSHOTS: Readonly<Record<string, unknown>> = {};

export const useLeadTree = ({ sessionId, rootAgentId, queue, queued }: Params): LeadTreeModel => {
  const views = useAutoTreeViews({ sessionId });
  const isWork = useIsWorkOn();
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  const telemetry = useAppStore((state) => state.sessionTelemetry[sessionId] ?? NO_TELEMETRY);
  const agentRunHistory = useSessionRunHistory({ sessionId });
  const spendByAgentId = useMemo(
    () => agentSpendById({ records: telemetry, agents, agentRunHistory }),
    [agentRunHistory, agents, telemetry],
  );
  const rootTurn = useAppStore((state) => state.agentTurnState[rootAgentId] ?? null);
  const view = useMemo(
    () => autoTreeOfAgent({ views, agentId: rootAgentId })?.view ?? null,
    [views, rootAgentId],
  );
  const root = useMemo((): LeadTreeRootState | null => {
    if (view === null) {
      return null;
    }
    const state = autoTreeWordOf({ view, rootTurn, isWork });
    return { node: state.node, word: state.word, ask: view.rootAsk };
  }, [view, rootTurn, isWork]);
  const { rows } = queued;
  const model = useMemo(() => {
    if (view === null) {
      return { tree: null, items: NO_ITEMS };
    }
    const createdAtById = new Map<string, number>();
    for (const message of view.pendingMessages) {
      createdAtById.set(message.rowId, message.createdAt);
    }
    for (const turn of queue) {
      createdAtById.set(turn.id, Date.parse(turn.createdAt));
    }
    const notes = noteNodesOf({
      rows,
      createdAtById,
      isWork,
      read: view.readMessages ?? NO_READ,
    });
    const facts = leadTreeDelegationsOf({
      delegations: view.delegations,
      agents,
      spendByAgentId,
      leadAgentId: rootAgentId,
    });
    const tree = leadTreeOf({
      delegations: facts.delegations,
      notes: notes.timed,
      plans: [],
      leadAgentId: rootAgentId,
      leadSpendUsd: spendByAgentId.get(rootAgentId) ?? 0,
      primaryMountId: view.tree.primaryMountId,
      openFoldIds: NO_FOLDS,
      canFold: false,
    });
    return {
      tree,
      items: leadTreeItemsOf({ tree, agentsById: facts.agentsById, notes: notes.nodes }),
    };
  }, [view, rows, queue, agents, spendByAgentId, rootAgentId, isWork]);
  return {
    items: model.items,
    root,
    tree: model.tree,
    delegations: view?.delegations ?? NO_DELEGATIONS,
    launchSnapshots: view?.launchSnapshots ?? NO_SNAPSHOTS,
    onEditNote: queued.onEdit,
    onRemoveNote: queued.onRemove,
  };
};
