import { useId, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button, cn, Reveal, Tooltip } from '@goodboy/ui';
import type { AgentId, ProviderRunId, SessionId } from '@goodboy/types';
import type { RetryRunParams } from '../../retryRun';
import type { TranscriptItem } from '../../utils/transcript-items';
import { permissionFor } from '../../utils/toolStatus';
import { turnSummary } from '../../utils/turnSummary';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { TranscriptCard } from '../TranscriptCards';

type Props = {
  readonly steps: ReadonlyArray<TranscriptItem>;
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
  readonly workingDir: string | null;
  readonly onOpenDiff: (filePath: string) => void;
  readonly onRefreshAuth: () => void;
  readonly onRetryRun: (params: RetryRunParams) => void;
  readonly retryingRunId: ProviderRunId | null;
  readonly activeRunId: ProviderRunId | null;
  readonly onOpenTranscript?: () => void;
};

const MAX_INLINE_STEPS = 20;

export const TurnSummaryLine = ({
  steps,
  sessionId,
  agentId,
  workingDir,
  onOpenDiff,
  onRefreshAuth,
  onRetryRun,
  retryingRunId,
  activeRunId,
  onOpenTranscript,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const listId = useId();
  const summary = useMemo(() => turnSummary({ steps }), [steps]);
  if (summary === null) {
    return null;
  }
  const shown = steps.slice(0, MAX_INLINE_STEPS);
  const isCapped = steps.length > MAX_INLINE_STEPS;

  return (
    <div data-turn-steps className="flex min-w-0 flex-col gap-1">
      <Tooltip content={summary.title}>
        <Button
          variant="quiet"
          size="xs"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-label={summary.title}
          onClick={() => setIsOpen((wasOpen) => !wasOpen)}
          className="group min-w-0 max-w-full justify-start self-start px-0 font-normal hover:bg-transparent"
        >
          <span className="min-w-0 truncate">{summary.text}</span>
          {summary.errorCount === 0 ? null : (
            <span className="shrink-0 tabular-nums text-danger">
              ({summary.errorCount} {summary.errorCount === 1 ? 'error' : 'errors'})
            </span>
          )}
          <ChevronRight
            size={ICON_SIZE.row}
            aria-hidden
            className={cn(
              'shrink-0 text-faint-foreground group-hover:text-muted-foreground motion-safe:transition-transform',
              isOpen && 'rotate-90',
            )}
          />
        </Button>
      </Tooltip>
      <Reveal open={isOpen} id={listId}>
        <ol className="flex flex-col gap-0.5">
          {shown.map((item) => (
            <li key={item.key}>
              <TranscriptCard
                item={item}
                sessionId={sessionId}
                agentId={agentId}
                workingDir={workingDir}
                onRefreshAuth={onRefreshAuth}
                onOpenDiff={onOpenDiff}
                onRetryRun={onRetryRun}
                retryingRunId={retryingRunId}
                activeRunId={activeRunId}
                permission={
                  item.kind === 'tool_call'
                    ? permissionFor({ items: steps, toolUseId: item.toolUseId })
                    : undefined
                }
              />
            </li>
          ))}
          {onOpenTranscript === undefined ? null : (
            <li>
              <Button
                variant="quiet"
                size="sm"
                onClick={onOpenTranscript}
                className="px-0 font-normal hover:bg-transparent"
              >
                {isCapped ? `Show all ${steps.length} steps in transcript` : 'Open in transcript'}
              </Button>
            </li>
          )}
        </ol>
      </Reveal>
    </div>
  );
};
