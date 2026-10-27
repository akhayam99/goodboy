import { Rocket } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';

import { NAMES } from '../../../shared/utils/names';

type Props = {
  readonly label: string;
  readonly isBusy?: boolean;
  readonly onClick: () => void;
};

export const StartButton = ({ label, isBusy = false, onClick }: Props) => (
  <Button
    size="sm"
    data-demo-anchor="task-start"
    isBusy={isBusy}
    busyLabel={NAMES.starting}
    onClick={onClick}
  >
    <Rocket size={ICON_SIZE.row} aria-hidden />
    {label}
  </Button>
);
