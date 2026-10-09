import { RefreshCw, SquareTerminal } from 'lucide-react';
import { Button, OverflowMenu, type OverflowMenuItem } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly isBusy: boolean;
  readonly onRefresh: () => void;
  readonly onShowBackups: () => void;
  readonly onOpenTerminal: () => void;
};

export const HistoryActions = ({ isBusy, onRefresh, onShowBackups, onOpenTerminal }: Props) => {
  const BackupIcon = CONCEPT_ICONS.backup;
  const overflow: OverflowMenuItem[] = [
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
      <Button size="xs" variant="ghost" disabled={isBusy} onClick={onRefresh}>
        <RefreshCw size={ICON_SIZE.row} aria-hidden />
        Refresh
      </Button>
      <Button size="xs" variant="secondary" onClick={onShowBackups}>
        <BackupIcon size={ICON_SIZE.row} aria-hidden />
        Backups
      </Button>
      <OverflowMenu
        items={overflow}
        label="More history actions"
        align="right"
        trigger={<CONCEPT_ICONS.more size={ICON_SIZE.row} aria-hidden />}
      />
    </>
  );
};
