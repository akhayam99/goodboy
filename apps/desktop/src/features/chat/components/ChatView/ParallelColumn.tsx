import { useLayoutEffect, useMemo, useRef } from 'react';
import { ArrowDown } from 'lucide-react';
import type { Agent, ProviderRunId } from '@goodboy/types';
import { ScrollFade } from '@goodboy/ui';
import { useAppStore, useTranscript } from '../../../../store';
import { filterEventsByRunId, reduceTranscript } from '../../utils/transcript-items';
import { inferAgentKindFromName } from '../../../session/agent-kind';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import { TranscriptCard } from '../TranscriptCards';
import { useScrollPin } from './useScrollPin';

type Props = {
  readonly runId: ProviderRunId;
  readonly index: number;
  readonly events: ReturnType<typeof useTranscript>;
  readonly workingDir: string | null;
  readonly onRefreshAuth: () => void;
  readonly onOpenDiff: (filePath: string) => void;
};

export const ParallelColumn = ({
  runId,
  index,
  events,
  workingDir,
  onRefreshAuth,
  onOpenDiff,
}: Props) => {
  const columnEvents = useMemo(() => filterEventsByRunId(events, runId), [events, runId]);
  const items = useMemo(() => reduceTranscript(columnEvents), [columnEvents]);
  const { scrollerRef, pinned, onScroll } = useScrollPin([items]);
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
    <div
      data-run-column={runId}
      className="flex min-w-0 flex-col border-r border-border last:border-r-0"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
        <AgentAvatar kind={kind} size="sm" title={label} />
        <span className="min-w-0 truncate text-foreground/80">{label}</span>
        {isRunning ? (
          <span
            className="ml-auto size-1.5 shrink-0 rounded-full bg-info motion-safe:animate-soft-pulse"
            aria-label="running"
          />
        ) : null}
      </div>
      <div ref={fadeHostRef} className="relative flex min-h-0 flex-1 flex-col">
        <ScrollFade className="flex-1" viewportClassName="px-3 py-3">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground">no events yet for {label}.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {items.map((item) => (
                <li key={item.key}>
                  <TranscriptCard
                    item={item}
                    workingDir={workingDir}
                    onRefreshAuth={onRefreshAuth}
                    onOpenDiff={onOpenDiff}
                  />
                </li>
              ))}
            </ul>
          )}
        </ScrollFade>
        {!pinned && (
          <button
            type="button"
            aria-label="jump to latest"
            title="jump to latest"
            className="pointer-events-auto absolute bottom-3 left-1/2 z-10 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-border-soft bg-background/90 ring-1 ring-border-soft transition-colors hover:bg-muted"
            onClick={() => {
              const el = scrollerRef.current;
              el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
            }}
          >
            <ArrowDown size={14} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
};
