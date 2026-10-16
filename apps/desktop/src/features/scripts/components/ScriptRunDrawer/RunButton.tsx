import { Play } from 'lucide-react';
import { Button, Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly canRun: boolean;
  readonly blockedReason: string;
  readonly label: string;
  readonly isPrimary: boolean;
  readonly onRun: () => void;
};

export const RunButton = ({ canRun, blockedReason, label, isPrimary, onRun }: Props) => {
  const button = (
    <Button
      variant={isPrimary ? 'primary' : 'secondary'}
      size="sm"
      onClick={onRun}
      disabled={!canRun}
    >
      <Play size={ICON_SIZE.row} aria-hidden />
      {label}
    </Button>
  );
  if (canRun) {
    return button;
  }
  return <Tooltip content={blockedReason}>{button}</Tooltip>;
};
