import { Button, cn } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly label: string;
  readonly onClick: () => void;
  readonly className?: string;
};

const CommentIcon = CONCEPT_ICONS.comments;

export const CommentButton = ({ label, onClick, className }: Props) => (
  <Button
    variant="ghost"
    size="sm"
    aria-label={label}
    onClick={onClick}
    className={cn('bg-elevated text-muted-foreground hover:text-foreground', className)}
  >
    <CommentIcon size={ICON_SIZE.control} aria-hidden />
    Comment
  </Button>
);
