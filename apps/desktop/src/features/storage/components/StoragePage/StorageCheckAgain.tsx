import { RefreshCw } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatSince } from '../../storageCopy';

export const StorageCheckAgain = () => {
  const checkedAt = useAppStore((state) => state.storageStats?.checkedAt ?? null);
  const isLoading = useAppStore((state) => state.storageStatsLoading);
  const loadStorage = useAppStore((state) => state.loadStorage);
  const reportError = useAppStore((state) => state.reportError);
  const onCheck = () =>
    void loadStorage({ isForced: true }).catch((error: unknown) =>
      reportError({ title: "Couldn't read storage usage", error }),
    );
  return (
    <span className="flex items-center gap-2 text-2xs text-faint-foreground">
      {checkedAt === null ? null : (
        <span>Checked {formatSince({ from: checkedAt, now: Date.now() })} ago</span>
      )}
      <Button variant="ghost" size="sm" onClick={onCheck} isBusy={isLoading} busyLabel="Checking">
        <RefreshCw size={ICON_SIZE.row} aria-hidden />
        Check again
      </Button>
    </span>
  );
};
