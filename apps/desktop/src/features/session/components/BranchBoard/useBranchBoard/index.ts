import { useMemo } from 'react';
import type { Agent, Session, TelemetryRecord } from '@goodboy/types';
import { useAppStore, useSessionOpenQuestions } from '../../../../../store';
import type { AutoTreeView } from '../../../../../store/slices/auto-view/state';
import { unreadAgentsOf } from '../../../../../store/slices/agents/unreadAgentsOf';
import { useNow } from '../../../../../shared/hooks/useNow';
import { useSessionMountHosts } from '../../../../../shared/hooks/useSessionMountHosts';
import { useSessionRunHistory } from '../../../../../shared/hooks/useSessionRunHistory';
import { liveAutoViewsOf } from '../../../../auto/liveAutoViewsOf';
import type { BranchEntry } from '../../../central/branches/branchStoryOf';
import { boardInputsOf } from '../../../central/board/boardInputsOf';
import { branchBoardOf, NO_BRANCH_ROW_ID } from '../../../central/board/branchBoardOf';
import type { BranchBoard } from '../../../central/board/boardTypes';
import { sessionKpisOf, type SessionKpis } from '../../../central/board/sessionKpisOf';
import { agentSpendById } from '../../../timeline/agentSpendById';

type Params = {
  readonly session: Session;
  readonly entries: ReadonlyArray<BranchEntry>;
};

type Result = Readonly<{
  board: BranchBoard;
  kpis: SessionKpis;
  entryByRowId: ReadonlyMap<string, BranchEntry>;
  mergedAtByMountId: ReadonlyMap<string, number>;
  runningByRowId: ReadonlyMap<string, number>;
  newRowIds: ReadonlySet<string>;
  now: number;
}>;

const NO_AGENTS: ReadonlyArray<Agent> = [];

const NO_VIEWS: ReadonlyArray<AutoTreeView> = [];

const NO_TELEMETRY: ReadonlyArray<TelemetryRecord> = [];

const CLOCK_MS = 30_000;

export const useBranchBoard = ({ session, entries }: Params): Result => {
  const sessionId = session.id;
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  const allViews = useAppStore((state) => state.autoTreeViews[sessionId] ?? NO_VIEWS);
  const telemetry = useAppStore((state) => state.sessionTelemetry[sessionId] ?? NO_TELEMETRY);
  const questions = useSessionOpenQuestions(sessionId);
  const agentRunHistory = useSessionRunHistory({ sessionId });
  const { mountGithub } = useSessionMountHosts({ sessionId });
  const now = useNow(CLOCK_MS, true);
  const views = useMemo(() => liveAutoViewsOf({ views: allViews, agents }), [agents, allViews]);
  const spendByAgentId = useMemo(
    () => agentSpendById({ records: telemetry, agents, agentRunHistory }),
    [agentRunHistory, agents, telemetry],
  );
  const mergedAtByMountId = useMemo(() => {
    const byMount = new Map<string, number>();
    for (const entry of entries) {
      const mergedAt = Date.parse(mountGithub?.[entry.fact.mountId]?.pr?.mergedAt ?? '');
      if (Number.isFinite(mergedAt)) {
        byMount.set(entry.fact.mountId, mergedAt);
      }
    }
    return byMount;
  }, [entries, mountGithub]);
  const inputs = useMemo(
    () => boardInputsOf({ agents, questions, views, spendByAgentId, now }),
    [agents, now, questions, spendByAgentId, views],
  );
  const board = useMemo(
    () =>
      branchBoardOf({
        session,
        branches: entries.map((entry) => entry.fact),
        ...inputs,
        recencyByMountId: mergedAtByMountId,
      }),
    [entries, inputs, mergedAtByMountId, session],
  );
  const runningByRowId = useMemo(() => {
    const known = new Set<string>(board.rows.map((row) => row.id));
    const byRow = new Map<string, number>();
    for (const agent of inputs.agents) {
      if (!agent.isRunning) {
        continue;
      }
      const key =
        agent.mountId !== null && known.has(agent.mountId) ? agent.mountId : NO_BRANCH_ROW_ID;
      byRow.set(key, (byRow.get(key) ?? 0) + 1);
    }
    return byRow;
  }, [board.rows, inputs.agents]);
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
  return { board, kpis, entryByRowId, mergedAtByMountId, runningByRowId, newRowIds, now };
};
