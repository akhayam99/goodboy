import type { OrchestratorHint } from '@goodboy/types';
import { OrchestratorHintRow } from './OrchestratorHintRow';

type Props = {
  readonly hints: ReadonlyArray<OrchestratorHint>;
  readonly disabled: boolean;
  readonly onRemove: (hintId: string) => void;
  readonly onPin: (hintId: string, isPinned: boolean) => void;
};

type SortParams = {
  readonly hints: ReadonlyArray<OrchestratorHint>;
};

const byNewest = ({ hints }: SortParams): ReadonlyArray<OrchestratorHint> =>
  [...hints].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

export const OrchestratorHintLog = ({ hints, disabled, onRemove, onPin }: Props) => {
  const pinned = hints.filter((hint) => hint.isPinned);
  const queued = hints.filter((hint) => hint.isPinned === false && hint.consumedAt == null);
  const read = hints.filter((hint) => hint.isPinned === false && hint.consumedAt != null);
  const ordered = [
    ...byNewest({ hints: pinned }),
    ...byNewest({ hints: queued }),
    ...byNewest({ hints: read }),
  ];
  if (ordered.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Hints" data-testid="orchestrator-hint-log" className="flex flex-col gap-1">
      {ordered.map((hint) => (
        <OrchestratorHintRow
          key={hint.id}
          hint={hint}
          disabled={disabled}
          onRemove={() => onRemove(hint.id)}
          onPin={(isPinned) => onPin(hint.id, isPinned)}
        />
      ))}
    </ul>
  );
};
