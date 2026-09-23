import type { OrchestratorHint } from '@goodboy/types';
import { OrchestratorHintRow } from './OrchestratorHintRow';

type Props = {
  readonly hints: ReadonlyArray<OrchestratorHint>;
  readonly disabled: boolean;
  readonly onRemove: (hintId: string) => void;
};

export const OrchestratorHintLog = ({ hints, disabled, onRemove }: Props) => {
  if (hints.length === 0) {
    return null;
  }
  const newestFirst = [...hints].reverse();
  return (
    <ul aria-label="Hints" data-testid="orchestrator-hint-log" className="flex flex-col gap-1">
      {newestFirst.map((hint) => (
        <OrchestratorHintRow
          key={hint.id}
          hint={hint}
          disabled={disabled}
          onRemove={() => onRemove(hint.id)}
        />
      ))}
    </ul>
  );
};
