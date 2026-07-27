import { useEffect, useState } from 'react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly name: string;
  readonly isEditing: boolean;
  readonly isSelected: boolean;
  readonly onRenameCommit: (name: string) => void;
  readonly onRenameCancel: () => void;
};

export const AgentCardTitle = ({
  name,
  isEditing,
  isSelected,
  onRenameCommit,
  onRenameCancel,
}: Props) => {
  const [draft, setDraft] = useState(name);

  useEffect(() => {
    if (!isEditing) {
      return;
    }
    setDraft(name);
  }, [isEditing, name]);

  if (!isEditing) {
    return (
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-left text-2xs font-medium',
          isSelected ? 'text-foreground' : 'text-muted-foreground',
        )}
        title={name}
      >
        {name}
      </span>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      aria-label="rename agent"
      onChange={(event) => setDraft(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') {
          event.preventDefault();
          onRenameCommit(draft);
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          onRenameCancel();
        }
      }}
      onBlur={() => onRenameCommit(draft)}
      className="min-w-0 flex-1 rounded-md bg-background px-1.5 py-0.5 text-2xs font-medium text-foreground outline-none ring-1 ring-primary"
    />
  );
};
