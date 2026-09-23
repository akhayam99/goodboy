import { Pin, PinOff, X } from 'lucide-react';
import type { OrchestratorHint } from '@goodboy/types';
import { IconButton, cn } from '@goodboy/ui';

type Props = {
  readonly hint: OrchestratorHint;
  readonly disabled: boolean;
  readonly onRemove: () => void;
  readonly onPin: (isPinned: boolean) => void;
};

type StatusParams = {
  readonly hint: OrchestratorHint;
};

const statusFor = ({ hint }: StatusParams): string => {
  if (hint.isPinned) {
    return 'every step';
  }
  if (hint.consumedAt == null) {
    return 'queued';
  }
  return hint.consumedAtStep == null ? 'read' : `read at step ${hint.consumedAtStep}`;
};

export const OrchestratorHintRow = ({ hint, disabled, onRemove, onPin }: Props) => {
  const isRead = hint.isPinned === false && hint.consumedAt != null;
  const status = statusFor({ hint });
  return (
    <li
      data-testid="orchestrator-hint-row"
      data-status={hint.isPinned ? 'pinned' : isRead ? 'read' : 'queued'}
      className={cn(
        'flex items-start gap-2 rounded-md border px-2 py-1 text-2xs',
        hint.isPinned && 'border-border-soft bg-background/60',
        hint.isPinned === false && isRead === false && 'border-dashed border-warning/50',
        isRead && 'border-transparent text-muted-foreground',
      )}
    >
      <span className={cn('min-w-0 flex-1 leading-relaxed', isRead === false && 'text-foreground')}>
        {hint.text}
      </span>
      <span
        className={cn(
          'shrink-0 tabular-nums leading-relaxed',
          hint.isPinned === false && isRead === false ? 'text-warning' : 'text-muted-foreground',
        )}
      >
        {status}
      </span>
      {isRead ? null : (
        <span className="flex shrink-0 items-center gap-0.5">
          <IconButton
            icon={hint.isPinned ? PinOff : Pin}
            label={hint.isPinned ? 'Read it only once' : 'Keep for every step'}
            variant="ghost"
            iconSize={11}
            disabled={disabled}
            onClick={() => onPin(hint.isPinned === false)}
          />
          <IconButton
            icon={X}
            label="Remove hint"
            variant="ghost"
            iconSize={11}
            disabled={disabled}
            onClick={onRemove}
          />
        </span>
      )}
    </li>
  );
};
