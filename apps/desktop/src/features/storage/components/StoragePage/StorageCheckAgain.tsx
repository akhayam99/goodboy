import { RefreshCw } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatAge } from '../../../../shared/utils/time/formatAge';

export const StorageCheckAgain = () => {
  const checkedAt = useAppStore((state) => state.storageStats?.checkedAt ?? null);
  const isLoading = useAppStore((state) => state.storageStatsLoading);
  const now = useNow(30_000);
  const loadStorage = useAppStore((state) => state.loadStorage);
  const reportError = useAppStore((state) => state.reportError);
  const onCheck = () =>
    void loadStorage({ isForced: true }).catch((error: unknown) =>
      reportError({ title: "Couldn't read storage usage", error }),
    );
  return (
    <span className="flex items-center gap-2 text-meta text-faint-foreground">
      {checkedAt === null ? null : <span>Checked {formatAge({ from: checkedAt, now })}</span>}
      <Button variant="ghost" size="sm" onClick={onCheck} isBusy={isLoading} busyLabel="Checking">
        <RefreshCw size={ICON_SIZE.row} aria-hidden />
        Check again
      </Button>
    </span>
  );
};
