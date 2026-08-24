import { useMemo } from 'react';
import { cn, formatUsd, Tooltip } from '@goodboy/ui';
import type { SessionId, TelemetryRecord } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSummarizerStatus } from '../../../../store';
import type { LensKind } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { SummarizerBadge } from '../SummarizerBadge';
import { VITAL_CHIP } from './vitalChip';

type Props = {
  readonly sessionId: SessionId;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const ContextChip = ({ sessionId, onSelectLens }: Props) => {
  const telemetry = useAppStore(
    (s) => s.sessionTelemetry[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );
  const { status } = useSummarizerStatus(sessionId);

  const summarizerSpend = useMemo(() => {
    let estimatedCostUsd = 0;
    let count = 0;
    for (const record of telemetry) {
      if (record.kind !== 'summarizer') {
        continue;
      }
      estimatedCostUsd += record.estimatedCostUsd;
      count += 1;
    }
    return { estimatedCostUsd, count };
  }, [telemetry]);

  const hasSpend = summarizerSpend.count > 0;
  const isWorking = status === 'running';
  const tooltip = isWorking
    ? 'The summarizer is refreshing decisions and the session summary'
    : hasSpend
      ? `Decisions and session summary, kept fresh by the summarizer, spent Σ ${formatUsd(summarizerSpend.estimatedCostUsd)}`
      : 'Decisions and session summary, kept fresh by the summarizer';

  return (
    <span className="flex shrink-0 items-center gap-1">
      <Tooltip content={tooltip}>
        <button
          type="button"
          onClick={() => onSelectLens('context')}
          className={cn(VITAL_CHIP, isWorking && 'spin-border spin-border-primary')}
        >
          <CONCEPT_ICONS.context size={11} aria-hidden className="text-primary" />
          <span>Context</span>
          {hasSpend ? (
            <span className="font-mono tabular-nums text-muted-foreground/70">
              Σ {formatUsd(summarizerSpend.estimatedCostUsd)}
            </span>
          ) : null}
        </button>
      </Tooltip>
      {isWorking ? null : <SummarizerBadge sessionId={sessionId} />}
    </span>
  );
};
