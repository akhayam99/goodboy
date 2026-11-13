import { useRef, useState } from 'react';
import { Pencil, Trash2, Undo2 } from 'lucide-react';
import { Button, Chip, ClampedProse, cn, ICON_SIZE, Markdown, FOCUS_RING } from '@goodboy/ui';
import { useFreshLanding } from '../../../chat/reveal/useFreshLanding';
import { BlockEditor } from './BlockEditor';
import { DecisionNumber } from './DecisionNumber';

const CHARS_PER_LINE = 72;

type OverflowParams = {
  readonly text: string;
};

const overflowsTwoLines = ({ text }: OverflowParams): boolean =>
  text
    .split('\n')
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / CHARS_PER_LINE)), 0) > 2;

type Props = {
  readonly number: number;
  readonly text: string;
  readonly liveKey: string | null;
  readonly why: string | null;
  readonly byline: string;
  readonly changeLabel: string | null;
  readonly isClosed: boolean;
  readonly reworded: { readonly age: string; readonly previousText: string } | null;
  readonly isLocked: boolean;
  readonly isHighlighted: boolean;
  readonly isOpen: boolean;
  readonly isRemoved: boolean;
  readonly rowRef: (element: HTMLDivElement | null) => void;
  readonly onToggleOpen: () => void;
  readonly onReword: (text: string) => void;
  readonly onRemove: () => void;
  readonly onUndoRemove: () => void;
};

export const DecisionRowItem = ({
  number,
  text,
  liveKey,
  why,
  byline,
  changeLabel,
  isClosed,
  reworded,
  isLocked,
  isHighlighted,
  isOpen,
  isRemoved,
  rowRef,
  onToggleOpen,
  onReword,
  onRemove,
  onUndoRemove,
}: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isPreviousShown, setIsPreviousShown] = useState(false);
  const [draft, setDraft] = useState(text);
  const firstText = useRef(text);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const isSwapped = text !== firstText.current;
  const label = `Decision ${number}`;
  const isLong = overflowsTwoLines({ text });
  const landing = useFreshLanding({ liveKey, text });
  const longLabel = isOpen ? 'Show less' : 'Show more';
  const shortLabel = `${isOpen ? 'Hide' : 'Show'} ${label.toLowerCase()} actions`;
  const toggleLabel = isLong ? longLabel : shortLabel;

  const commit = () => {
    setIsEditing(false);
    if (draft.trim() === '' || draft === text) {
      return;
    }
    onReword(draft);
  };

  if (isEditing) {
    return (
      <BlockEditor
        value={draft}
        label={`Edit ${label.toLowerCase()}`}
        minRows={2}
        onChange={setDraft}
        onCommit={commit}
        onCancel={() => {
          setDraft(text);
          setIsEditing(false);
        }}
      />
    );
  }

  if (isRemoved) {
    return (
      <div
        ref={rowRef}
        data-decision={number}
        className="flex items-start gap-3 rounded-lg px-2 py-2"
      >
        <span className="opacity-60">
          <DecisionNumber number={number} isClosed={isClosed} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="line-clamp-2 text-faint-foreground line-through [overflow-wrap:anywhere]">
            <Markdown text={text} className="text-meta" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Chip tone="neutral" kind="state" label="Removed" />
          {isLocked ? null : (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Undo remove of decision ${number}`}
              onClick={onUndoRemove}
            >
              <Undo2 size={ICON_SIZE.row} aria-hidden />
              Undo
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      key={landing.fadeKey}
      {...landing.fade}
      ref={rowRef}
      data-decision={number}
      className={cn(
        'group/decision-row flex items-start gap-3 rounded-lg px-2 py-2 motion-safe:transition-colors',
        isOpen ? 'bg-fill' : isHighlighted ? 'bg-selected' : 'hover:bg-hover',
      )}
    >
      <DecisionNumber number={number} isClosed={isClosed} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          key={text}
          data-swapped={isSwapped ? 'true' : undefined}
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest('a') !== null) {
              return;
            }
            onToggleOpen();
            toggleRef.current?.focus();
          }}
          className={cn(
            'cursor-pointer [overflow-wrap:anywhere] [&_pre]:whitespace-pre-wrap',
            !isOpen && 'line-clamp-2',
            isClosed && 'text-faint-foreground line-through',
            isSwapped && 'motion-safe:animate-text-swap',
          )}
        >
          <Markdown text={text} className="text-meta" />
        </div>
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={isOpen}
          onClick={onToggleOpen}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && isOpen) {
              onToggleOpen();
            }
          }}
          className={cn(
            'self-start rounded-sm text-left text-meta text-muted-foreground',
            !isLong && 'sr-only focus-visible:not-sr-only',
            FOCUS_RING,
          )}
        >
          {toggleLabel}
        </button>
        {why === null ? null : (
          <div data-decision-why={number} className="[overflow-wrap:anywhere]">
            <ClampedProse text={why} lines={2} className="text-meta text-muted-foreground" />
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex flex-wrap items-center gap-1 text-meta text-faint-foreground">
            {changeLabel === null ? null : (
              <Chip tone={isClosed ? 'neutral' : 'primary'} kind="state" label={changeLabel} />
            )}
            {byline}
          </p>
          {isOpen && !isLocked && !isClosed ? (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Edit ${label.toLowerCase()}`}
                onClick={() => {
                  setDraft(text);
                  setIsEditing(true);
                }}
              >
                <Pencil size={ICON_SIZE.row} aria-hidden />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove ${label.toLowerCase()}`}
                onClick={onRemove}
              >
                <Trash2 size={ICON_SIZE.row} aria-hidden />
                Remove
              </Button>
            </div>
          ) : null}
        </div>
        {reworded === null ? null : (
          <p className="flex flex-wrap items-center gap-1 text-meta text-faint-foreground">
            {`Goodboy · ${reworded.age}`}
            <button
              type="button"
              aria-expanded={isPreviousShown}
              onClick={() => setIsPreviousShown(!isPreviousShown)}
              className={cn(
                'rounded-sm text-muted-foreground underline-offset-2 hover:underline',
                FOCUS_RING,
              )}
            >
              {isPreviousShown ? 'Hide previous' : 'Show previous'}
            </button>
          </p>
        )}
        {reworded !== null && isPreviousShown ? (
          <p className="text-meta text-faint-foreground line-through">{reworded.previousText}</p>
        ) : null}
      </div>
    </div>
  );
};
