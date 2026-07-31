import { cn } from '@goodboy/ui';
import { useInlineRename } from '../../../../shared/hooks/useInlineRename';

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
  const rename = useInlineRename({
    value: name,
    isEditing,
    onCommit: onRenameCommit,
    onCancel: onRenameCancel,
  });

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
      value={rename.draft}
      aria-label="rename agent"
      onChange={(event) => rename.setDraft(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={rename.onKeyDown}
      onBlur={() => void rename.commit()}
      className="min-w-0 flex-1 rounded-md bg-background px-1.5 py-0.5 text-2xs font-medium text-foreground outline-none ring-1 ring-primary"
    />
  );
};
