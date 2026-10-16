import { Button } from '@goodboy/ui';
import { X } from 'lucide-react';
import { ICON_SIZE } from '../conceptIcons';

type Props = {
  readonly label: string;
  readonly onClose: () => void;
};

export const StudioCloseButton = ({ label, onClose }: Props) => (
  <Button variant="ghost" size="sm" onClick={onClose} aria-label={label}>
    <X size={ICON_SIZE.control} aria-hidden /> Close
  </Button>
);
