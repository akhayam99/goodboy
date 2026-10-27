import { StatusDot, Tooltip, inlineMarkdownText, FOCUS_RING, cn } from '@goodboy/ui';
import type { OrchestratorHint } from '@goodboy/types';

type Props = {
  readonly hint: OrchestratorHint;
  readonly isReading: boolean;
  readonly onRemove: () => void;
};

const REMOVE = cn(
  'inline-flex h-6 shrink-0 items-center rounded-md px-2 text-ui text-muted-foreground hover:bg-hover hover:text-foreground',
  FOCUS_RING,
  'disabled:pointer-events-none disabled:opacity-50',
);

export const OrchestratedHintChip = ({ hint, isReading, onRemove }: Props) => {
  const remove = (
    <button type="button" className={REMOVE} disabled={isReading} onClick={onRemove}>
      Remove
    </button>
  );
  const lines = hint.text.split('\n').filter((line) => line.trim() !== '');
  const first = lines[0] ?? hint.text;
  const extra = lines.length - 1;
  const text = (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span className="min-w-0 truncate text-foreground">
        {inlineMarkdownText({ text: first })}
      </span>
      {extra > 0 ? (
        <span className="shrink-0 text-faint-foreground">
          {`+${extra} ${extra === 1 ? 'line' : 'lines'}`}
        </span>
      ) : null}
    </span>
  );
  return (
    <li
      data-hint-chip={isReading ? 'reading' : 'queued'}
      className="flex h-8 min-w-0 items-center gap-2 rounded-md bg-subtle px-2 text-ui"
    >
      {extra > 0 ? (
        <Tooltip content={hint.text} side="top" anchorClassName="flex min-w-0 flex-1">
          {text}
        </Tooltip>
      ) : (
        text
      )}
      {isReading ? (
        <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
          <StatusDot tone="info" size="sm" pulsing />
          Reading now
        </span>
      ) : null}
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
