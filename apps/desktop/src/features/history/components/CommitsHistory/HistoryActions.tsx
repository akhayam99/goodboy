import { RefreshCw, SquareTerminal } from 'lucide-react';
import { Button, IconButton } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly isBusy: boolean;
  readonly onRefresh: () => void;
  readonly onShowBackups: () => void;
  readonly onOpenTerminal: () => void;
};

export const HistoryActions = ({ isBusy, onRefresh, onShowBackups, onOpenTerminal }: Props) => {
  const BackupIcon = CONCEPT_ICONS.backup;
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
      <IconButton
        icon={SquareTerminal}
        label="Open terminal here"
        size="sm"
        onClick={onOpenTerminal}
      />
    </>
  );
};
