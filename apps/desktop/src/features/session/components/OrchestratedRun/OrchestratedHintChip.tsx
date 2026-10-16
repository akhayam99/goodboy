import { StatusDot, Tooltip, inlineMarkdownText } from '@goodboy/ui';
import type { OrchestratorHint } from '@goodboy/types';

type Props = {
  readonly hint: OrchestratorHint;
  readonly isReading: boolean;
  readonly onRemove: () => void;
};

const REMOVE =
  'inline-flex h-6 shrink-0 items-center rounded-md px-2 text-ui text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:pointer-events-none disabled:opacity-50';

export const OrchestratedHintChip = ({ hint, isReading, onRemove }: Props) => {
  const remove = (
    <button type="button" className={REMOVE} disabled={isReading} onClick={onRemove}>
      Remove
    </button>
  );
  return (
    <li
      data-hint-chip={isReading ? 'reading' : 'queued'}
      className="flex h-8 min-w-0 items-center gap-2 rounded-md bg-subtle px-2 text-ui"
    >
      <span className="min-w-0 flex-1 truncate text-foreground">
        {inlineMarkdownText({ text: hint.text })}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
        {isReading ? <StatusDot tone="info" size="sm" pulsing /> : null}
        {isReading ? 'Reading now' : 'Waits for the next decision'}
      </span>
      {isReading ? (
        <Tooltip content="The orchestrator is reading it now" side="top">
          <span className="inline-flex">{remove}</span>
        </Tooltip>
      ) : (
        remove
      )}
    </li>
  );
};
