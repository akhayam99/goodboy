import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Bot, GitBranch, MessageSquareReply, Network } from 'lucide-react';
import type { Agent, AgentId, Session, SessionId, WorkspaceId } from '@goodboy/types';
import { Divider, Eyebrow, ScrollFade, StatCard, StatusDot, cn } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { SpawnTree } from '../SpawnTree';
import { RunLane } from '../RunLane';
import { useWorkspaceRuns } from '../../hooks/useWorkspaceRuns';
import { useRunsNavigation } from '../../hooks/useRunsNavigation';

type RunsBoardProps = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
  readonly focusSessionId?: SessionId | null;
  readonly requestClose: () => void;
};

const sectionLabel = (label: string) => (
  <Eyebrow label={label} className="text-muted-foreground/70" />
);

export const RunsBoard = ({
  workspaceId,
  sessions,
  focusSessionId,
  requestClose,
}: RunsBoardProps) => {
  const { lanes, freeAgents, resolveQueue, aggregate } = useWorkspaceRuns(workspaceId, sessions);
  const nav = useRunsNavigation(requestClose);

  const sessionIds = useMemo(
    () => sessions.filter((s) => s.workspaceId === workspaceId).map((s) => s.id as SessionId),
    [sessions, workspaceId],
  );
  const sessionOfNode = useAppStore(
    useShallow((s) => {
      const map: Record<string, SessionId> = {};
      for (const id of sessionIds) {
        const runs = s.sessionPhaseRuns[id] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>);
        for (const agent of runs) {
          map[agent.id] = id;
        }
      }
      return map;
    }),
  );

  const sortedLanes = useMemo(() => {
    if (!focusSessionId) {
      return lanes;
    }
    return [...lanes].sort((a, b) => {
      const aFocus = a.sessionId === focusSessionId ? 0 : 1;
      const bFocus = b.sessionId === focusSessionId ? 0 : 1;
      return aFocus - bFocus;
    });
  }, [lanes, focusSessionId]);

  const onSelectAgent = (sid: SessionId | null) => (agentId: AgentId) => {
    const resolved = sid ?? sessionOfNode[agentId] ?? null;
    if (resolved) {
      nav.openAgentFromRun(resolved, agentId);
    }
  };

  const onSelectFromNode = (agentId: AgentId) => {
    const resolved = sessionOfNode[agentId] ?? null;
    if (resolved) {
      nav.openAgentFromRun(resolved, agentId);
    }
  };

  const empty = aggregate.runCount === 0 && aggregate.agentCount === 0;

  return (
    <div className="flex min-h-0 w-full flex-col">
      <div className="shrink-0 px-6 py-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            icon={<Network size={16} aria-hidden />}
            tone="primary"
            label="runs"
            value={`${aggregate.runCount}`}
            valueSize="lg"
          />
          <StatCard
            icon={<Bot size={16} aria-hidden />}
            tone="accent"
            label="agents"
            value={`${aggregate.agentCount}`}
            valueSize="lg"
          />
          <StatCard
            tone="info"
            label="running"
            value={`${aggregate.runningCount}`}
            valueSize="lg"
            status={
              aggregate.runningCount > 0 ? <StatusDot tone="info" size="sm" pulsing /> : undefined
            }
          />
          <StatCard
            tone="danger"
            label="stalled"
            value={`${aggregate.stalledCount}`}
            valueSize="lg"
            alert={aggregate.stalledCount > 0}
          />
          <StatCard
            tone="neutral"
            label="spend"
            value={`$${aggregate.spendUsd.toFixed(2)}`}
            valueSize="lg"
          />
        </div>
      </div>
      <Divider />
      <ScrollFade className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 px-6 py-4">
          {empty ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-soft bg-elevated/40 px-6 py-12 text-center">
              <span
                aria-hidden
                className="flex size-12 items-center justify-center rounded-full bg-primary/10"
              >
                <Network size={24} className="text-primary" aria-hidden />
              </span>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground">No runs yet</p>
                <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                  Attach a workflow or spawn an agent in a session and its pipeline shows up here as
                  a lane.
                </p>
              </div>
            </div>
          ) : (
            <>
              {sortedLanes.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {sectionLabel('Runs')}
                  {sortedLanes.map((lane) => (
                    <RunLane
                      key={lane.runId}
                      lane={lane}
                      onSelectAgent={onSelectAgent(lane.sessionId)}
                      onJumpToComment={nav.jumpToComment}
                    />
                  ))}
                </div>
              ) : null}

              {freeAgents.length > 0 ? (
                <div
                  className={cn(
                    'flex flex-col gap-2 rounded-lg border border-border-soft bg-muted/20 p-3',
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <GitBranch size={12} aria-hidden className="text-muted-foreground/70" />
                    {sectionLabel('Free agents')}
                  </span>
                  <SpawnTree
                    nodes={freeAgents}
                    variant="dashboard"
                    onSelect={onSelectFromNode}
                    onJumpToComment={nav.jumpToComment}
                  />
                </div>
              ) : null}

              {resolveQueue.length > 0 ? (
                <div className="flex flex-col gap-2 rounded-lg border border-border-soft bg-muted/20 p-3">
                  <span className="flex items-center gap-1.5">
                    <MessageSquareReply size={12} aria-hidden className="text-success" />
                    {sectionLabel('Resolve queue')}
                  </span>
                  <SpawnTree
                    nodes={resolveQueue}
                    variant="dashboard"
                    onSelect={onSelectFromNode}
                    onJumpToComment={nav.jumpToComment}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </ScrollFade>
    </div>
  );
};
