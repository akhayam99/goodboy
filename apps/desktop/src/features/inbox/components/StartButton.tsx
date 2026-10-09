import { Rocket } from 'lucide-react';
import { Button, Kbd } from '@goodboy/ui';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
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
    <Kbd look="inline" onTone aria-hidden>
      {shortcutGlyphs('list.open')}
    </Kbd>
  </Button>
);
