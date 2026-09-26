import { useState } from 'react';
import { Minus, Pencil } from 'lucide-react';
import { CardAction, CardActionSlot, Chip, Markdown, cn } from '@goodboy/ui';
import { BlockEditor } from './BlockEditor';
import { DecisionNumber } from './DecisionNumber';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

const RewordIcon = CONCEPT_ICONS.enhance;

const REVEAL_GROUP =
  'group-hover/decision-row:opacity-100 group-focus-within/decision-row:opacity-100';

type Props = {
  readonly number: number;
  readonly text: string;
  readonly byline: string;
  readonly isNew: boolean;
  readonly reworded: { readonly age: string; readonly previousText: string } | null;
  readonly isLocked: boolean;
  readonly isHighlighted: boolean;
  readonly rowRef: (element: HTMLDivElement | null) => void;
  readonly onReword: (text: string) => void;
  readonly onWithdraw: () => void;
};

export const DecisionRowItem = ({
  number,
  text,
  byline,
  isNew,
  reworded,
  isLocked,
  isHighlighted,
  rowRef,
  onReword,
  onWithdraw,
}: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isPreviousShown, setIsPreviousShown] = useState(false);
  const [draft, setDraft] = useState(text);
  const label = `Decision ${number}`;

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

  return (
    <div
      ref={rowRef}
      data-decision={number}
      className={cn(
        'group/decision-row flex items-start gap-2.5 rounded-lg px-2 py-2 motion-safe:transition-colors',
        isHighlighted ? 'bg-selected' : 'hover:bg-hover',
      )}
    >
      <DecisionNumber number={number} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="line-clamp-2 [overflow-wrap:anywhere] [&_pre]:whitespace-pre-wrap">
          <Markdown text={text} className="text-label" />
        </div>
        <p className="flex flex-wrap items-center gap-1.5 text-secondary text-faint-foreground">
          {isNew ? <Chip tone="primary" size="3xs" label="New" /> : null}
          {byline}
        </p>
        {reworded === null ? null : (
          <p className="flex flex-wrap items-center gap-1.5 text-secondary text-faint-foreground">
            <RewordIcon size={10} aria-hidden className="shrink-0" />
            {`Reworded by Goodboy · ${reworded.age}`}
            <button
              type="button"
              aria-expanded={isPreviousShown}
              onClick={() => setIsPreviousShown(!isPreviousShown)}
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
      {isLocked ? null : (
        <CardActionSlot label={`${label} actions`}>
          <CardAction
            icon={Pencil}
            label={`Edit ${label.toLowerCase()}`}
            reveal
            revealGroup={REVEAL_GROUP}
            onClick={() => {
              setDraft(text);
              setIsEditing(true);
            }}
          />
          <CardAction
            icon={Minus}
            label={`Withdraw ${label.toLowerCase()}`}
            reveal
            revealGroup={REVEAL_GROUP}
            onClick={onWithdraw}
          />
        </CardActionSlot>
      )}
    </div>
  );
};
