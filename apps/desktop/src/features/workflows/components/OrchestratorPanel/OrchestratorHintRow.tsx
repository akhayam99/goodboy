import { X } from 'lucide-react';
import type { OrchestratorHint } from '@goodboy/types';
import { IconButton, cn, tintClasses } from '@goodboy/ui';

type Props = {
  readonly hint: OrchestratorHint;
  readonly disabled: boolean;
  readonly onRemove: () => void;
};

type StatusParams = {
  readonly hint: OrchestratorHint;
};

const statusFor = ({ hint }: StatusParams): string => {
  if (hint.consumedAt == null) {
    return 'queued';
  }
  return hint.consumedAtStep == null ? 'read' : `read at step ${hint.consumedAtStep}`;
};

export const OrchestratorHintRow = ({ hint, disabled, onRemove }: Props) => {
  const isQueued = hint.consumedAt == null;
  return (
    <li
      data-testid="orchestrator-hint-row"
      data-status={isQueued ? 'queued' : 'read'}
      className={cn(
        'flex items-start gap-2 rounded-md border px-2 py-1 text-2xs',
        isQueued
          ? cn('border-dashed', tintClasses('warning').border)
          : 'border-border-soft bg-background',
      )}
    >
      <span className="min-w-0 flex-1 leading-relaxed text-foreground">{hint.text}</span>
      <span
        className={cn(
          'shrink-0 tabular-nums leading-relaxed',
          isQueued ? 'text-warning' : 'text-muted-foreground',
        )}
      >
        {statusFor({ hint })}
      </span>
      <IconButton
        icon={X}
        label="Remove hint"
        tooltip="Remove it from what the orchestrator reads"
        variant="ghost"
        iconSize={11}
        disabled={disabled}
        onClick={onRemove}
      />
    </li>
  );
};
