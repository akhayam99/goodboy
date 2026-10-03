import { useState } from 'react';
import { ImageIcon, X } from 'lucide-react';
import type { GoalAttachment, OrchestratorHint } from '@goodboy/types';
import { IconButton, Markdown, StatusDot, cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { OrchestratorHintStatus } from './orchestratorHintStatus';

type Props = {
  readonly hint: OrchestratorHint;
  readonly status: OrchestratorHintStatus;
  readonly attachments: ReadonlyArray<GoalAttachment>;
  readonly onRemove: () => void;
};

type ReadLabelParams = {
  readonly hint: OrchestratorHint;
};

const LONG_LINES = 5;
const LONG_CHARS = 300;

const readLabel = ({ hint }: ReadLabelParams): string =>
  hint.consumedAtStep == null ? 'Read' : `Read at step ${hint.consumedAtStep}`;

const isLongHint = ({ hint }: ReadLabelParams): boolean =>
  hint.text.split('\n').length > LONG_LINES || hint.text.length > LONG_CHARS;

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

export const OrchestratorHintRow = ({ hint, status, attachments, onRemove }: Props) => {
  const isReading = status === 'reading';
  const isLong = isLongHint({ hint });
  const [isExpanded, setIsExpanded] = useState(false);
  const missing = (hint.attachmentIds?.length ?? 0) - attachments.length;
  return (
    <li
      data-testid="orchestrator-hint-row"
      data-status={status}
      className={cn(
        'flex flex-wrap items-start gap-x-2 gap-y-1 rounded-md border bg-background px-2 py-1 text-secondary',
        ROW_CLASSES[status],
      )}
    >
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <div
          data-testid="orchestrator-hint-text"
          className={cn(
            'min-w-0 leading-relaxed',
            status === 'read' ? 'text-muted-foreground' : 'text-foreground',
            isLong && !isExpanded && 'max-h-20 overflow-hidden',
          )}
        >
          <Markdown text={hint.text} className="text-body" />
        </div>
        {attachments.length > 0 || missing > 0 ? (
          <ul aria-label="Hint files" className="flex flex-wrap gap-1.5">
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="flex max-w-48 items-center gap-1 rounded-sm bg-subtle px-1.5 text-muted-foreground"
              >
                <ImageIcon size={ICON_SIZE.row} aria-hidden />
                <span className="truncate">{attachment.fileName}</span>
              </li>
            ))}
            {missing > 0 ? (
              <li className="text-faint-foreground">
                {`${attachments.length > 0 ? '+' : ''}${missing} file${missing === 1 ? '' : 's'}`}
              </li>
            ) : null}
          </ul>
        ) : null}
        {isLong ? (
          <button
            type="button"
            className="self-start text-muted-foreground hover:text-foreground"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((open) => !open)}
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        ) : null}
      </div>
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
