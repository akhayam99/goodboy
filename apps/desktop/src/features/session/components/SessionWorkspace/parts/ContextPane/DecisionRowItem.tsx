import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  CardAction,
  CardActionSlot,
  InlineConfirm,
  Markdown,
  cn,
  tintClasses,
  type Tone,
} from '@goodboy/ui';
import { BlockEditor } from './BlockEditor';

const REVEAL_GROUP =
  'group-hover/decision-row:opacity-100 group-focus-within/decision-row:opacity-100';

type Props = {
  readonly text: string;
  readonly position: number;
  readonly tone: Tone;
  readonly isLocked: boolean;
  readonly onCommit: (text: string) => void;
  readonly onDelete: () => void;
};

export const DecisionRowItem = ({ text, position, tone, isLocked, onCommit, onDelete }: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteArmed, setIsDeleteArmed] = useState(false);
  const [draft, setDraft] = useState(text);
  const tint = tintClasses(tone);
  const label = `Decision ${position}`;

  const commit = () => {
    setIsEditing(false);
    const next = draft.trim();
    if (next === '' || draft === text) {
      return;
    }
    onCommit(draft);
  };

  if (isEditing) {
    return (
      <BlockEditor
        value={draft}
        label={`Edit ${label.toLowerCase()}`}
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
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          'group/decision-row flex items-start gap-2 rounded-lg border bg-muted/30 p-3 motion-safe:transition-colors',
          tint.borderSoft,
          isLocked ? '' : 'hover:bg-muted/50',
        )}
      >
        <button
          type="button"
          disabled={isLocked}
          aria-label={`Edit ${label.toLowerCase()}`}
          onClick={() => {
            setDraft(text);
            setIsEditing(true);
          }}
          className={cn(
            'min-w-0 flex-1 rounded-md text-left text-sm leading-relaxed text-foreground [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] [&_pre]:whitespace-pre-wrap',
            isLocked ? 'cursor-default' : 'cursor-text',
          )}
        >
          <Markdown text={text} />
        </button>
        <CardActionSlot label={`${label} actions`}>
          <CardAction
            icon={Trash2}
            label={`Delete ${label.toLowerCase()}`}
            tone="danger"
            reveal={isDeleteArmed === false}
            revealGroup={REVEAL_GROUP}
            highlighted={isDeleteArmed}
            expanded={isDeleteArmed}
            disabled={isLocked}
            onClick={() => setIsDeleteArmed(true)}
          />
        </CardActionSlot>
      </div>
      {isDeleteArmed ? (
        <InlineConfirm
          role="danger"
          icon={<Trash2 size={12} aria-hidden />}
          title="Delete this decision?"
          description="Removes the row from the decisions document."
          confirmLabel="Delete decision"
          autoDisarmMs={4000}
          onConfirm={() => {
            onDelete();
            setIsDeleteArmed(false);
          }}
          onCancel={() => setIsDeleteArmed(false)}
        />
      ) : null}
    </div>
  );
};
