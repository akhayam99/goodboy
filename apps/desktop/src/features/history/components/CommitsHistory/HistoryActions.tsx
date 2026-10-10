import { Button } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly onShowBackups: () => void;
};

export const HistoryActions = ({ onShowBackups }: Props) => {
  const BackupIcon = CONCEPT_ICONS.backup;
  return (
    <Button size="xs" variant="secondary" onClick={onShowBackups}>
      <BackupIcon size={ICON_SIZE.row} aria-hidden />
      Backups
    </Button>
  );
};
