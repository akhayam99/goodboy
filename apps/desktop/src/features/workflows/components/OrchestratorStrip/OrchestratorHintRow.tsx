import { X } from 'lucide-react';
import type { OrchestratorHint } from '@goodboy/types';
import { IconButton, StatusDot, cn, tintClasses } from '@goodboy/ui';
import type { OrchestratorHintStatus } from './orchestratorHintStatus';

type Props = {
  readonly hint: OrchestratorHint;
  readonly status: OrchestratorHintStatus;
  readonly onRemove: () => void;
};

type ReadLabelParams = {
  readonly hint: OrchestratorHint;
};

const readLabel = ({ hint }: ReadLabelParams): string =>
  hint.consumedAtStep == null ? 'Read' : `Read at step ${hint.consumedAtStep}`;

const ROW_CLASSES: Record<OrchestratorHintStatus, string> = {
  queued: cn('border-dashed', tintClasses('warning').border),
  reading: tintClasses('info').border,
  read: 'border-border-soft',
};

const STATUS_TEXT_CLASSES: Record<OrchestratorHintStatus, string> = {
  queued: 'text-warning',
  reading: 'text-info',
  read: 'text-muted-foreground',
};

export const OrchestratorHintRow = ({ hint, status, onRemove }: Props) => {
  const isReading = status === 'reading';
  return (
    <li
      data-testid="orchestrator-hint-row"
      data-status={status}
      className={cn(
        'flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-secondary',
        ROW_CLASSES[status],
      )}
    >
      <span
        className={cn(
          'min-w-0 flex-1 leading-relaxed',
          status === 'read' ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {hint.text}
      </span>
      <span
        data-testid="orchestrator-hint-status"
        className={cn(
          'flex shrink-0 items-center gap-1.5 tabular-nums leading-relaxed',
          STATUS_TEXT_CLASSES[status],
        )}
      >
        {isReading && <StatusDot tone="info" size="sm" pulsing />}
        {status === 'queued' && 'Waits for the next decision'}
        {isReading && 'Reading now'}
        {status === 'read' && readLabel({ hint })}
      </span>
      <IconButton
        icon={X}
        label="Remove hint"
        tooltip={
          isReading
            ? 'The orchestrator is reading it now'
            : 'Remove it from what the orchestrator reads'
        }
        variant="ghost"
        iconSize={11}
        disabled={isReading}
        onClick={onRemove}
      />
    </li>
  );
};
