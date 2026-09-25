import { useState } from 'react';
import { Check } from 'lucide-react';
import type { OrchestratorHint } from '@goodboy/types';
import { CountToggle } from '@goodboy/ui';
import { OrchestratorHintRow } from './OrchestratorHintRow';
import { orchestratorHintStatus, type OrchestratorHintStatus } from './orchestratorHintStatus';

type Props = {
  readonly hints: ReadonlyArray<OrchestratorHint>;
  readonly readingHintIds: ReadonlyArray<string>;
  readonly onRemove: (hintId: string) => void;
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

export const OrchestratorHintLog = ({ hints, readingHintIds, onRemove }: Props) => {
  const [isReadShown, setIsReadShown] = useState(false);
  if (hints.length === 0) {
    return null;
  }
  const entries = [...hints]
    .reverse()
    .map((hint) => ({ hint, status: orchestratorHintStatus({ hint, readingHintIds }) }));
  const open = entries.filter((entry) => entry.status !== 'read');
  const read = entries.filter((entry) => entry.status === 'read');
  const shown = isReadShown ? [...open, ...read] : open;
  const stepsLabel = readStepsLabel({ entries: read });
  return (
    <div data-testid="orchestrator-hint-log" className="flex flex-col gap-1">
      {shown.length > 0 && (
        <ul aria-label="Hints" className="flex flex-col gap-1">
          {shown.map(({ hint, status }) => (
            <OrchestratorHintRow
              key={hint.id}
              hint={hint}
              status={status}
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
              className="min-w-0 truncate text-2xs tabular-nums text-muted-foreground"
            >
              {stepsLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
