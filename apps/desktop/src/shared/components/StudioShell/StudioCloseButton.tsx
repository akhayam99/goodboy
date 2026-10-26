import { Button, ICON_SIZE } from '@goodboy/ui';
import { X } from 'lucide-react';

type Props = {
  readonly label: string;
  readonly onClose: () => void;
};

export const StudioCloseButton = ({ label, onClose }: Props) => (
  <Button variant="ghost" size="sm" onClick={onClose} aria-label={label}>
    <X size={ICON_SIZE.control} aria-hidden /> Close
  </Button>
);
