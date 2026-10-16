import { Rocket } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/names';

type Props = {
  readonly label: string;
  readonly isBusy?: boolean;
  readonly onClick: () => void;
};

export const StartButton = ({ label, isBusy = false, onClick }: Props) => (
  <Button size="sm" isBusy={isBusy} busyLabel={NAMES.starting} onClick={onClick}>
    <Rocket size={ICON_SIZE.row} aria-hidden />
    {label}
  </Button>
);
