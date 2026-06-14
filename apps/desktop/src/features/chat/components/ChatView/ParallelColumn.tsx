import { useMemo } from 'react';
import { ArrowDown } from 'lucide-react';
import type { ProviderRunId } from '@goodboy/types';
import { useTranscript } from '../../../../store';
import { filterEventsByRunId, reduceTranscript } from '../../utils/transcript-items';
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

  return (
    <div
      data-run-column={runId}
      className="flex min-w-0 flex-col border-r border-border last:border-r-0"
    >
      <div className="border-b border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
        p{index + 1}
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scrollerRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 py-3">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground">no events yet for run p{index + 1}.</p>
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
        </div>
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
