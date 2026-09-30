import { RefreshCw, SquareTerminal } from 'lucide-react';
import { Button, OverflowMenu, type OverflowMenuItem } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly isBusy: boolean;
  readonly onRefresh: () => void;
  readonly onShowBackups: () => void;
  readonly onOpenTerminal: () => void;
};

export const HistoryPageActions = ({ isBusy, onRefresh, onShowBackups, onOpenTerminal }: Props) => {
  const overflow: OverflowMenuItem[] = [
    {
      kind: 'item',
      key: 'backups',
      label: 'Backups',
      icon: CONCEPT_ICONS.backup,
      onClick: onShowBackups,
    },
    {
      kind: 'item',
      key: 'terminal',
      label: 'Open terminal here',
      icon: SquareTerminal,
      onClick: onOpenTerminal,
    },
  ];
  return (
    <>
      <Button size="sm" variant="ghost" disabled={isBusy} onClick={onRefresh}>
        <RefreshCw size={ICON_SIZE.row} aria-hidden />
        Refresh
      </Button>
      <OverflowMenu items={overflow} label="More history actions" align="right" />
    </>
  );
};
