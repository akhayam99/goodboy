import { Eye } from 'lucide-react';
import { IconButton, cn } from '@goodboy/ui';
import type { Visibility } from './roleVisibility';

type Props = {
  readonly visibility: Visibility;
  readonly isOpen: boolean;
  readonly panelId: string;
  readonly onToggle: () => void;
};

export const ContextVisibilityToggle = ({ visibility, isOpen, panelId, onToggle }: Props) => (
  <IconButton
    icon={Eye}
    label={`Visible to ${visibility.summary}`}
    aria-expanded={isOpen}
    aria-controls={isOpen ? panelId : undefined}
    onClick={onToggle}
    className={cn(isOpen && 'bg-selected text-foreground')}
  />
);
