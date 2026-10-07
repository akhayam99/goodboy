import { useId, useState } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import type { GoalAttachment, OrchestratorHint } from '@goodboy/types';
import { CountToggle } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { OrchestratorHintRow } from './OrchestratorHintRow';
import { orchestratorHintStatus, type OrchestratorHintStatus } from './orchestratorHintStatus';

type Props = {
  readonly hints: ReadonlyArray<OrchestratorHint>;
  readonly readingHintIds: ReadonlyArray<string>;
  readonly runAttachments: ReadonlyArray<GoalAttachment>;
  readonly onRemove: (hintId: string) => void;
};

type FilesParams = {
  readonly hint: OrchestratorHint;
  readonly runAttachments: ReadonlyArray<GoalAttachment>;
};

const NO_FILES: ReadonlyArray<GoalAttachment> = [];

const filesOf = ({ hint, runAttachments }: FilesParams): ReadonlyArray<GoalAttachment> => {
  const ids = hint.attachmentIds ?? [];
  if (ids.length === 0) {
    return NO_FILES;
  }
  return runAttachments.filter((attachment) => ids.includes(attachment.id));
};

type Entry = {
  readonly hint: OrchestratorHint;
  readonly status: OrchestratorHintStatus;
};

type ReadStepsParams = {
  readonly entries: ReadonlyArray<Entry>;
};

const readStepsLabel = ({ entries }: ReadStepsParams): string | null => {
  const steps = [
    ...new Set(
      entries.flatMap(({ hint }) => (hint.consumedAtStep == null ? [] : [hint.consumedAtStep])),
    ),
  ].sort((left, right) => left - right);
  if (steps.length === 0) {
    return null;
  }
  return `Read at step ${steps.join(', ')}`;
};

export const OrchestratorHintLog = ({ hints, readingHintIds, runAttachments, onRemove }: Props) => {
  const [isReadShown, setIsReadShown] = useState(false);
  const [isQueuedShown, setIsQueuedShown] = useState(false);
  const listId = useId();
  if (hints.length === 0) {
    return null;
  }
  const entries = [...hints]
    .reverse()
    .map((hint) => ({ hint, status: orchestratorHintStatus({ hint, readingHintIds }) }));
  const queued = entries.filter((entry) => entry.status === 'queued');
  const open = entries.filter((entry) => entry.status !== 'read');
  const read = entries.filter((entry) => entry.status === 'read');
  const openShown = isQueuedShown ? open : open.filter((entry) => entry.status === 'reading');
  const shown = isReadShown ? [...openShown, ...read] : openShown;
  const stepsLabel = readStepsLabel({ entries: read });
  const QueuedChevron = isQueuedShown ? ChevronDown : ChevronRight;
  return (
    <div data-testid="orchestrator-hint-log" className="flex flex-col gap-1">
      {queued.length > 0 && (
        <button
          type="button"
          data-testid="orchestrator-hint-queued"
          aria-expanded={isQueuedShown}
          aria-controls={isQueuedShown ? listId : undefined}
          onClick={() => setIsQueuedShown((isShown) => !isShown)}
          className="flex h-7 min-w-0 items-center gap-2 rounded-md px-2 text-label text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <QueuedChevron size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          <span className="text-row tabular-nums text-foreground">{queued.length} queued</span>
          <span className="min-w-0 flex-1 truncate text-left text-meta text-faint-foreground">
            Read at the next decision
          </span>
        </button>
      )}
      {shown.length > 0 && (
        <ul id={listId} aria-label="Hints" className="flex flex-col gap-1">
          {shown.map(({ hint, status }) => (
            <OrchestratorHintRow
              key={hint.id}
              hint={hint}
              status={status}
              attachments={filesOf({ hint, runAttachments })}
              onRemove={() => onRemove(hint.id)}
            />
          ))}
        </ul>
      )}
      {read.length > 0 && (
        <div className="flex min-w-0 items-center justify-between gap-2">
          <CountToggle
            label="read"
            count={read.length}
            icon={Check}
            isShown={isReadShown}
            onChange={setIsReadShown}
          />
          {stepsLabel != null && (
            <span
              data-testid="orchestrator-hint-read-steps"
              className="min-w-0 truncate text-meta tabular-nums text-muted-foreground"
            >
              {stepsLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
