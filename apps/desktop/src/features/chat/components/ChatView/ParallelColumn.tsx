import { useLayoutEffect, useMemo, useRef } from 'react';
import { ArrowDown } from 'lucide-react';
import type { Agent, ProviderRunId } from '@goodboy/types';
import { Divider, EmptyState, ScrollFade, StatusDot, Tooltip } from '@goodboy/ui';
import { useAppStore, useTranscript } from '../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { filterEventsByRunId, reduceTranscript } from '../../utils/transcript-items';
import type { TranscriptItem } from '../../utils/transcript-items';
import { clusterOperations } from '../../utils/cluster-operations';
import { inferAgentKindFromName } from '../../../session/agent-kind';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import { TranscriptCard } from '../TranscriptCards';
import { OperationsCluster } from '../OperationsCluster';
import { useScrollPin } from './useScrollPin';

type Props = {
  readonly runId: ProviderRunId;
  readonly index: number;
  readonly events: ReturnType<typeof useTranscript>;
  readonly workingDir: string | null;
  readonly onRefreshAuth: () => void;
  readonly onOpenDiff: (filePath: string) => void;
  readonly onRetryError?: (item: Extract<TranscriptItem, { kind: 'error' }>) => void;
  readonly retryingErrorRunId?: ProviderRunId | null;
};

export const ParallelColumn = ({
  runId,
  index,
  events,
  workingDir,
  onRefreshAuth,
  onOpenDiff,
  onRetryError,
  retryingErrorRunId = null,
}: Props) => {
  const columnEvents = useMemo(() => filterEventsByRunId(events, runId), [events, runId]);
  const items = useMemo(() => reduceTranscript(columnEvents), [columnEvents]);
  const rows = useMemo(() => clusterOperations(items), [items]);
  const { scrollerRef, pinned, onScroll } = useScrollPin([rows]);
  const fadeHostRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const viewport = fadeHostRef.current?.querySelector<HTMLDivElement>('.overflow-y-auto');
    if (!viewport) {
      return;
    }
    scrollerRef.current = viewport;
    viewport.addEventListener('scroll', onScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', onScroll);
  }, [scrollerRef, onScroll]);

  const agent = useAppStore((s) => {
    for (const runs of Object.values(s.sessionPhaseRuns)) {
      const match = (runs as ReadonlyArray<Agent>).find((r) => r.runId === runId);
      if (match) {
        return match;
      }
    }
    return null;
  });
  const turnRunning = useAppStore((s) =>
    agent ? s.agentTurnState[agent.id]?.kind === 'running' : false,
  );
  const isRunning = turnRunning || agent?.status === 'running';
  const kind = agent ? inferAgentKindFromName(agent.name) : 'generic';
  const label = agent?.name ?? `run ${index + 1}`;

  return (
    <div data-run-column={runId} className="flex min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground">
        <AgentAvatar kind={kind} size="sm" title={label} />
        <span className="min-w-0 truncate text-foreground/80">{label}</span>
        {isRunning ? (
          <StatusDot tone="info" size="sm" pulsing ariaLabel="Running" className="ml-auto" />
        ) : null}
      </div>
      <Divider />
      <div ref={fadeHostRef} className="relative flex min-h-0 flex-1 flex-col">
        <ScrollFade className="flex-1" viewportClassName="px-3 py-3">
          {rows.length === 0 ? (
            <EmptyState
              icon={CONCEPT_ICONS.agents}
              tone={CONCEPT_TONE.agents}
              title={`No events yet for ${label}.`}
              size="inline"
              className="p-0"
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {rows.map((row) => (
                <li key={row.key}>
                  {row.kind === 'operations' ? (
                    <OperationsCluster
                      items={row.items}
                      sessionId={agent?.sessionId ?? null}
                      agentId={agent?.id ?? null}
                      workingDir={workingDir}
                      onRefreshAuth={onRefreshAuth}
                      onOpenDiff={onOpenDiff}
                      onRetryError={onRetryError}
                      retryingErrorRunId={retryingErrorRunId}
                    />
                  ) : (
                    <TranscriptCard
                      item={row.item}
                      sessionId={agent?.sessionId ?? null}
                      agentId={agent?.id ?? null}
                      workingDir={workingDir}
                      onRefreshAuth={onRefreshAuth}
                      onOpenDiff={onOpenDiff}
                      onRetryError={onRetryError}
                      retryingErrorRunId={retryingErrorRunId}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </ScrollFade>
        {!pinned && (
          <Tooltip content="Jump to latest">
            <button
              type="button"
              aria-label="Jump to latest"
              className="pointer-events-auto absolute bottom-3 left-1/2 z-10 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-border-soft bg-background/90 ring-1 ring-border-soft transition-colors hover:bg-muted"
              onClick={() => {
                const el = scrollerRef.current;
                el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
              }}
            >
              <ArrowDown size={14} aria-hidden />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
};
