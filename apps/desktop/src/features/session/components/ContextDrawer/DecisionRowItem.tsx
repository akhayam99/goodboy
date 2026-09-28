import { useRef, useState } from 'react';
import { Pencil, Trash2, Undo2 } from 'lucide-react';
import { Button, Chip, ClampedProse, Markdown, cn } from '@goodboy/ui';
import { BlockEditor } from './BlockEditor';
import { DecisionNumber } from './DecisionNumber';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

const RewordIcon = CONCEPT_ICONS.enhance;
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
  readonly why: string | null;
  readonly byline: string;
  readonly isNew: boolean;
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
  why,
  byline,
  isNew,
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
  const isSwapped = text !== firstText.current;
  const label = `Decision ${number}`;
  const isLong = overflowsTwoLines({ text });

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
        className="flex items-start gap-2.5 rounded-lg px-2 py-2"
      >
        <span className="opacity-60">
          <DecisionNumber number={number} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="line-clamp-2 text-faint-foreground line-through [overflow-wrap:anywhere]">
            <Markdown text={text} className="text-label" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Chip tone="neutral" size="3xs" label="Removed" />
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
      ref={rowRef}
      data-decision={number}
      role="button"
      tabIndex={0}
      aria-expanded={isOpen}
      onClick={onToggleOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggleOpen();
          return;
        }
        if (event.key === 'Escape' && isOpen) {
          onToggleOpen();
        }
      }}
      className={cn(
        'group/decision-row flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        isOpen ? 'bg-fill' : isHighlighted ? 'bg-selected' : 'hover:bg-hover',
      )}
    >
      <DecisionNumber number={number} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          key={text}
          data-swapped={isSwapped ? 'true' : undefined}
          className={cn(
            '[overflow-wrap:anywhere] [&_pre]:whitespace-pre-wrap',
            !isOpen && 'line-clamp-2',
            isSwapped && 'motion-safe:animate-text-swap',
          )}
        >
          <Markdown text={text} className="text-label" />
        </div>
        {isLong ? (
          <button
            type="button"
            className="w-fit rounded-sm text-secondary text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            onClick={(event) => {
              event.stopPropagation();
              onToggleOpen();
            }}
          >
            {isOpen ? 'Show less' : 'Show more'}
          </button>
        ) : null}
        {why === null ? null : (
          <div data-decision-why={number} className="[overflow-wrap:anywhere]">
            <ClampedProse text={why} lines={2} className="text-secondary text-muted-foreground" />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="flex flex-wrap items-center gap-1.5 text-secondary text-faint-foreground">
            {isNew ? <Chip tone="primary" size="3xs" label="New" /> : null}
            {byline}
          </p>
          {isOpen && !isLocked ? (
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Edit ${label.toLowerCase()}`}
                onClick={(event) => {
                  event.stopPropagation();
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
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove();
                }}
              >
                <Trash2 size={ICON_SIZE.row} aria-hidden />
                Remove
              </Button>
            </div>
          ) : null}
        </div>
        {reworded === null ? null : (
          <p className="flex flex-wrap items-center gap-1.5 text-secondary text-faint-foreground">
            <RewordIcon size={10} aria-hidden className="shrink-0" />
            {`Reworded by Goodboy · ${reworded.age}`}
            <button
              type="button"
              aria-expanded={isPreviousShown}
              onClick={(event) => {
                event.stopPropagation();
                setIsPreviousShown(!isPreviousShown);
              }}
              className="rounded-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {isPreviousShown ? 'Hide previous' : 'Show previous'}
            </button>
          </p>
        )}
        {reworded !== null && isPreviousShown ? (
          <p className="text-secondary text-faint-foreground line-through">
            {reworded.previousText}
          </p>
        ) : null}
      </div>
    </div>
  );
};
