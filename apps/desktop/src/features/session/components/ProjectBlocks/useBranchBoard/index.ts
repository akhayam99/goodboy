import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, Session, SessionMountView, TelemetryRecord } from '@goodboy/types';
import { useAppStore, useSessionOpenQuestions } from '../../../../../store';
import type { AutoTreeView } from '../../../../../store/slices/auto-view/state';
import { unreadAgentsOf } from '../../../../../store/slices/agents/unreadAgentsOf';
import { useNow } from '../../../../../shared/hooks/useNow';
import { useSessionMountHosts } from '../../../../../shared/hooks/useSessionMountHosts';
import { useSessionRunHistory } from '../../../../../shared/hooks/useSessionRunHistory';
import { liveAutoViewsOf } from '../../../../auto/liveAutoViewsOf';
import type { BranchEntry } from '../../../central/branches/branchStoryOf';
import { boardInputsOf } from '../../../central/board/boardInputsOf';
import { branchBoardOf } from '../../../central/board/branchBoardOf';
import { runningByRowIdOf } from '../../../central/board/runningByRowIdOf';
import type { BranchBoard } from '../../../central/board/boardTypes';
import { sessionKpisOf, type SessionKpis } from '../../../central/board/sessionKpisOf';
import { placedAgentsOf } from '../../../placedAgentsOf';
import { agentSpendById } from '../../../timeline/agentSpendById';

type Params = {
  readonly session: Session;
  readonly entries: ReadonlyArray<BranchEntry>;
};

export type BranchBoardView = Readonly<{
  board: BranchBoard;
  kpis: SessionKpis;
  entryByRowId: ReadonlyMap<string, BranchEntry>;
  settledAtByMountId: ReadonlyMap<string, number>;
  runningByRowId: ReadonlyMap<string, number>;
  newRowIds: ReadonlySet<string>;
  now: number;
}>;

const NO_AGENTS: ReadonlyArray<Agent> = [];

const NO_VIEWS: ReadonlyArray<AutoTreeView> = [];

const NO_MOUNTS: ReadonlyArray<SessionMountView> = [];

const NO_TELEMETRY: ReadonlyArray<TelemetryRecord> = [];

const CLOCK_MS = 30_000;

export const useBranchBoard = ({ session, entries }: Params): BranchBoardView => {
  const sessionId = session.id;
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  const allViews = useAppStore((state) => state.autoTreeViews[sessionId] ?? NO_VIEWS);
  const mounts = useAppStore((state) => state.sessionMounts[sessionId] ?? NO_MOUNTS);
  const telemetry = useAppStore((state) => state.sessionTelemetry[sessionId] ?? NO_TELEMETRY);
  const questions = useSessionOpenQuestions(sessionId);
  const agentRunHistory = useSessionRunHistory({ sessionId });
  const { mountGithub } = useSessionMountHosts({ sessionId });
  const now = useNow(CLOCK_MS, true);
  const views = useMemo(() => liveAutoViewsOf({ views: allViews, agents }), [agents, allViews]);
  const rootTurns = useAppStore(
    useShallow((state) =>
      Object.fromEntries(
        views.map((view) => [view.tree.rootAgentId, state.agentTurnState[view.tree.rootAgentId]]),
      ),
    ),
  );
  const spendByAgentId = useMemo(
    () => agentSpendById({ records: telemetry, agents, agentRunHistory }),
    [agentRunHistory, agents, telemetry],
  );
  const settledAtByMountId = useMemo(() => {
    const byMount = new Map<string, number>();
    for (const entry of entries) {
      const pr = mountGithub?.[entry.fact.mountId]?.pr;
      const isClosed = entry.fact.request?.state === 'closed';
      const settledAt = Date.parse((isClosed ? pr?.updatedAt : pr?.mergedAt) ?? '');
      if (Number.isFinite(settledAt)) {
        byMount.set(entry.fact.mountId, settledAt);
      }
    }
    return byMount;
  }, [entries, mountGithub]);
  const placedAgents = useMemo(
    () => placedAgentsOf({ agents, autoViews: allViews, mounts }),
    [agents, allViews, mounts],
  );
  const inputs = useMemo(
    () => boardInputsOf({ agents: placedAgents, questions, views, rootTurns, spendByAgentId, now }),
    [now, placedAgents, questions, rootTurns, spendByAgentId, views],
  );
  const board = useMemo(
    () =>
      branchBoardOf({
        session,
        branches: entries.map((entry) => entry.fact),
        ...inputs,
        recencyByMountId: settledAtByMountId,
      }),
    [entries, inputs, settledAtByMountId, session],
  );
  const runningByRowId = useMemo(
    () => runningByRowIdOf({ rows: board.rows, agents: inputs.agents, leads: inputs.leads }),
    [board.rows, inputs.agents, inputs.leads],
  );
  const newRowIds = useMemo(() => {
    const unread = new Set<string>(
      unreadAgentsOf({ agents }).flatMap((agent) =>
        agent.mountId === undefined ? [] : [agent.mountId],
      ),
    );
    return new Set<string>(board.rows.filter((row) => unread.has(row.id)).map((row) => row.id));
  }, [agents, board.rows]);
  const kpis = useMemo(() => sessionKpisOf({ board }), [board]);
  const entryByRowId = useMemo(
    () => new Map<string, BranchEntry>(entries.map((entry) => [entry.fact.mountId, entry])),
    [entries],
  );
  return {
    board,
    kpis,
    entryByRowId,
    settledAtByMountId,
    runningByRowId,
    newRowIds,
    now,
  };
};
