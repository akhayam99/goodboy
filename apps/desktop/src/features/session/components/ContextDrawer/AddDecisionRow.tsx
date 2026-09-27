import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Input } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly isLocked: boolean;
  readonly onAdd: (text: string) => void;
};

export const AddDecisionRow = ({ isLocked, onAdd }: Props) => {
  const [draft, setDraft] = useState('');

  return (
    <div className="flex flex-col gap-1">
      <label className="relative flex items-center">
        <Plus
          size={ICON_SIZE.row}
          aria-hidden
          className="pointer-events-none absolute left-2.5 text-faint-foreground"
        />
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
          className="pl-8"
        />
      </label>
      {isLocked ? (
        <p className="text-secondary text-faint-foreground">
          Editing opens when the update finishes.
        </p>
      ) : null}
    </div>
  );
};
