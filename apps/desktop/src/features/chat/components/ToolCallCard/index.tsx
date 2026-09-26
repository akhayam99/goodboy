import { useMemo, useState } from 'react';
import { cn, tintClasses, WorkNode, type WorkNodeState } from '@goodboy/ui';
import type { ProviderRunId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import { formatDuration } from '../../utils/format-duration';
import { useElapsedMs } from '../../hooks/useElapsedMs';
import { toolStatus, type PermissionState, type ToolStatus } from '../../utils/toolStatus';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TranscriptRowHeader } from '../TranscriptRowHeader';
import { StructuredData } from './StructuredData';
import { hasImagePath } from './hasImagePath';
import { Section } from './Section';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'tool_call' }>;
  readonly activeRunId?: ProviderRunId | null;
  readonly permission?: PermissionState;
};

const dangerTint = tintClasses('danger');

const NODE_STATE_FOR: Record<ToolStatus, WorkNodeState> = {
  running: 'running',
  done: 'done',
  failed: 'failed',
  approval: 'approval',
  stopped: 'stopped',
  denied: 'skipped',
};

const NODE_LABEL_FOR: Record<ToolStatus, string> = {
  running: 'Running',
  done: 'Done',
  failed: 'Failed',
  approval: 'Needs approval',
  stopped: 'Stopped',
  denied: 'Denied',
};

export const ToolCallCard = ({ item, activeRunId, permission }: Props) => {
  const hasInputImages = useMemo(() => hasImagePath({ data: item.input }), [item.input]);
  const hasOutputImages = useMemo(() => hasImagePath({ data: item.output }), [item.output]);
  const [open, setOpen] = useState(false);
  const [rawMode, setRawMode] = useState(false);
  const status = toolStatus({ item, activeRunId, permission });
  const running = status === 'running';
  const elapsedMs = useElapsedMs({
    running,
    startedAt: item.startedAt,
    endedAt: item.endedAt,
  });
  const duration =
    status === 'approval' || elapsedMs == null ? null : formatDuration({ durationMs: elapsedMs });

  return (
    <TranscriptDisclosure
      tone="neutral"
      open={open}
      bodyClassName="gap-2"
      header={
        <TranscriptRowHeader
          grouped
          tone="neutral"
          icon={
            <span data-testid="tool-state-icon" data-node-state={status} className="shrink-0">
              <WorkNode
                size="sm"
                state={NODE_STATE_FOR[status]}
                mark={{ kind: 'dot' }}
                label={NODE_LABEL_FOR[status]}
              />
            </span>
          }
          eyebrow="tool"
          open={open}
          onToggle={() => setOpen((value) => !value)}
          preview={
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-mono text-muted-foreground">{item.toolName}</span>
              {status === 'failed' && (
                <span
                  className={cn('shrink-0 text-2xs uppercase tracking-eyebrow', dangerTint.text)}
                >
                  error
                </span>
              )}
            </span>
          }
          meta={duration ?? undefined}
        />
      }
    >
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setRawMode((value) => !value)}
          data-testid="raw-toggle"
          className="rounded-md px-1.5 py-0.5 text-2xs text-faint-foreground hover:bg-hover hover:text-foreground"
        >
          {rawMode ? 'structured' : 'raw json'}
        </button>
      </div>
      {rawMode ? (
        <>
          <Section label="input">
            <pre className="min-w-0 whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
              {JSON.stringify(item.input, null, 2)}
            </pre>
          </Section>
          {item.ended ? (
            <Section label="output">
              <pre className="min-w-0 whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                {JSON.stringify(item.output, null, 2)}
              </pre>
            </Section>
          ) : null}
        </>
      ) : (
        <>
          <Section label="input">
            <div className="min-w-0 text-xs">
              <StructuredData data={item.input} label="input" hasImages={hasInputImages} />
            </div>
          </Section>
          {item.ended ? (
            <Section label="output">
              <div className="min-w-0 text-xs">
                <StructuredData data={item.output} label="output" hasImages={hasOutputImages} />
              </div>
            </Section>
          ) : null}
        </>
      )}
    </TranscriptDisclosure>
  );
};
