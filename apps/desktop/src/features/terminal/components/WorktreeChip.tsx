import { Tooltip, chipClasses, cn } from '@goodboy/ui';

type Props = {
  readonly folder: string;
  readonly className?: string;
};

export const WorktreeChip = ({ folder, className }: Props) => (
  <Tooltip content={folder} anchorClassName="flex min-w-0 max-w-full">
    <span
      data-testid="worktree-chip"
      className={cn(
        chipClasses({ tone: 'neutral', kind: 'id', bordered: false, emphasis: 'subtle' }),
        'min-w-0 max-w-full',
        className,
      )}
    >
      <span className="truncate">{folder}</span>
    </span>
  </Tooltip>
);
