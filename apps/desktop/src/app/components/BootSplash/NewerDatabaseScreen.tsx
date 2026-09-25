import { NEWER_BUILD_MESSAGE } from '@goodboy/db';
import { Button, cn, formatError, tintClasses } from '@goodboy/ui';
import { useCallback, useState } from 'react';
import { BootBrand } from './BootBrand';

type Props = {
  readonly restorableSnapshot: string | null;
  readonly onRestore: () => Promise<void>;
  readonly onQuit: () => void;
};

export const NewerDatabaseScreen = ({ restorableSnapshot, onRestore, onQuit }: Props) => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const hasBackup = restorableSnapshot !== null;

  const restore = useCallback(async () => {
    setIsRestoring(true);
    setFailure(null);
    try {
      await onRestore();
    } catch (error) {
      setFailure(`The backup could not be restored: ${formatError(error)}`);
    } finally {
      setIsRestoring(false);
    }
  }, [onRestore]);

  return (
    <div className="relative flex h-screen flex-col items-center justify-center gap-10 bg-background px-4 text-foreground">
      <BootBrand />
      <div
        role="alert"
        className={cn(
          'flex w-full max-w-sm flex-col gap-3 rounded-r-md border-l-2 p-4 text-xs',
          tintClasses('warning').border,
        )}
      >
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground">{NEWER_BUILD_MESSAGE}</span>
          <p className="leading-relaxed text-muted-foreground">
            {hasBackup
              ? 'This version cannot read it. Restore the backup taken before the upgrade, or quit and open the newer version. Your current data stays in a copy next to the database.'
              : 'This version cannot read it, and no backup from before the upgrade was found. Quit and open the newer version.'}
          </p>
          {failure !== null ? <p className="leading-relaxed text-danger">{failure}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {hasBackup ? (
            <Button
              variant="primary"
              size="sm"
              isBusy={isRestoring}
              busyLabel="Restoring"
              onClick={() => void restore()}
            >
              Restore backup
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" disabled={isRestoring} onClick={onQuit}>
            Quit
          </Button>
        </div>
      </div>
    </div>
  );
};
