import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ICON_SIZE, Input } from '@goodboy/ui';

type Props = {
  readonly isLocked: boolean;
  readonly onAdd: (text: string) => void;
};

export const AddDecisionRow = ({ isLocked, onAdd }: Props) => {
  const [draft, setDraft] = useState('');

  return (
    <div className="flex flex-col gap-1">
      <label className="flex min-w-0 items-center gap-2 rounded-md px-2 hover:bg-hover">
        <Plus size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
        <Input
          aria-label="Add a decision"
          placeholder="Add a decision"
          value={draft}
          disabled={isLocked}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setDraft('');
              return;
            }
            if (event.key !== 'Enter' || draft.trim() === '') {
              return;
            }
            event.preventDefault();
            onAdd(draft.trim());
            setDraft('');
          }}
          className="min-w-0 flex-1 border-transparent bg-transparent px-0 text-meta disabled:bg-transparent"
        />
      </label>
      {isLocked ? (
        <p className="px-2 text-meta text-faint-foreground">
          Editing opens when the update finishes.
        </p>
      ) : null}
    </div>
  );
};
