import { cn } from '@goodboy/ui';
import { useInlineRename } from '../../../../shared/hooks/useInlineRename';
import type { AgentCardDensity } from './agentCardDensity';
import { agentCardTitleClass } from './agentCardTitleClass';

const INPUT_SIZE: Record<AgentCardDensity, string> = {
  lane: 'text-sm',
  sidebar: 'text-2xs',
};

type Props = {
  readonly name: string;
  readonly isEditing: boolean;
  readonly isSelected: boolean;
  readonly density?: AgentCardDensity;
  readonly onRenameCommit: (name: string) => void;
  readonly onRenameCancel: () => void;
};

export const AgentCardTitle = ({
  name,
  isEditing,
  isSelected,
  density = 'sidebar',
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
      <span className={agentCardTitleClass({ density, isSelected })} title={name}>
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
      onBlur={rename.onBlur}
      title={rename.error ?? undefined}
      aria-invalid={rename.error !== null}
      className={cn(
        'min-w-0 flex-1 rounded-md bg-background px-1.5 py-0.5 font-medium text-foreground outline-none ring-1',
        INPUT_SIZE[density],
        rename.error !== null ? 'ring-danger' : 'ring-primary',
      )}
    />
  );
};
