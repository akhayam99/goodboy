import { Button, ICON_SIZE, InlineConfirm, formatError } from '@goodboy/ui';
import { DatabaseBackup } from 'lucide-react';
import { useState } from 'react';
import { NAMES } from '../../../../shared/utils/names';
import { useAppStore } from '../../../../store';
import { BootErrorRecovery } from '../BootErrorRecovery';

type Props = {
  readonly error: string;
};

export const DatabaseRecovery = ({ error }: Props) => {
  const retryDatabaseOpen = useAppStore((state) => state.retryDatabaseOpen);
  const moveDatabaseAside = useAppStore((state) => state.moveDatabaseAside);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const retry = async () => {
    setIsRetrying(true);
    setFailure(null);
    try {
      await retryDatabaseOpen();
    } catch (caught) {
      setFailure(`Still can't open it: ${formatError(caught)}`);
      setIsRetrying(false);
    }
  };

  const leading = isConfirming ? null : (
    <>
      <Button
        variant="primary"
        size="sm"
        isBusy={isRetrying}
        busyLabel="Checking"
        onClick={() => void retry()}
      >
        {NAMES.retry}
      </Button>
      <Button variant="ghost" size="sm" disabled={isRetrying} onClick={() => setIsConfirming(true)}>
        Move aside and restart
      </Button>
    </>
  );

  const notes = isConfirming ? (
    <InlineConfirm
      role="alert"
      icon={<DatabaseBackup size={ICON_SIZE.control} aria-hidden />}
      title="Move the database aside?"
      description="The copy stays next to a new empty database."
      confirmLabel="Move aside and restart"
      onConfirm={moveDatabaseAside}
      onCancel={() => setIsConfirming(false)}
    />
  ) : failure === null ? null : (
    <p className="text-meta text-danger">{failure}</p>
  );

  return (
    <BootErrorRecovery
      error={error}
      category="database"
      title="Goodboy can't open its database"
      leading={leading}
      notes={notes}
      widthClass="w-96 max-w-full"
    />
  );
};
