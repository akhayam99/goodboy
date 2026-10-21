import { ArrowLeft } from 'lucide-react';
import { Button } from './Button';
import { ICON_SIZE } from '../iconSize';
import type { DrawerBack } from './DrawerFrame';

type Props = {
  readonly back: DrawerBack;
};

export const DrawerBackLink = ({ back }: Props) => (
  <div data-drawer-back="" className="flex shrink-0 px-2 pt-2">
    <Button variant="quiet" size="xs" onClick={back.onBack}>
      <ArrowLeft size={ICON_SIZE.row} aria-hidden />
      {back.label}
    </Button>
  </div>
);
