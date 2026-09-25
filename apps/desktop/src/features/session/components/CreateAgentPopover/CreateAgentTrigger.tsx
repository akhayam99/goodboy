import { Plus } from 'lucide-react';
import { Button, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly isOpen: boolean;
  readonly className?: string;
  readonly onClick: () => void;
};

export const CreateAgentTrigger = ({ isOpen, className, onClick }: Props) => (
  <Button
    variant="primary"
    size="sm"
    onClick={onClick}
    aria-haspopup="dialog"
    aria-expanded={isOpen}
    className={cn('min-w-0', className)}
  >
    <Plus size={ICON_SIZE.row} aria-hidden className="shrink-0" />
    <span className="truncate">Start agent</span>
  </Button>
);
