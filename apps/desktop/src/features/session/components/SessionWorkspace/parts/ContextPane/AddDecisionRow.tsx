import { useState } from 'react';
import { Plus } from 'lucide-react';
import { BlockEditor } from './BlockEditor';

type Props = {
  readonly isLocked: boolean;
  readonly onAdd: (text: string) => void;
};

export const AddDecisionRow = ({ isLocked, onAdd }: Props) => {
  const [isWriting, setIsWriting] = useState(false);
  const [draft, setDraft] = useState('');

  if (isWriting) {
    return (
      <BlockEditor
        value={draft}
        label="New decision"
        onChange={setDraft}
        onCommit={() => {
          setIsWriting(false);
          if (draft.trim() !== '') {
            onAdd(draft);
          }
          setDraft('');
        }}
        onCancel={() => {
          setDraft('');
          setIsWriting(false);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={isLocked}
      onClick={() => setIsWriting(true)}
      className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border-soft px-3 py-2 text-left text-xs leading-5 text-muted-foreground motion-safe:transition-colors hover:bg-muted/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:pointer-events-none disabled:opacity-40"
    >
      <Plus size={13} aria-hidden className="shrink-0" />
      Add decision
    </button>
  );
};
