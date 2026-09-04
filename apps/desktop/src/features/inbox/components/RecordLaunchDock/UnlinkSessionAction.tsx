import { useState } from 'react';
import { Unlink } from 'lucide-react';
import { formatError, GhostActionButton } from '@goodboy/ui';
import type { SessionExternalTaskProvider, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Props = {
  readonly sessionId: SessionId;
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
};

export const UnlinkSessionAction = ({ sessionId, provider, externalId }: Props) => {
  const unlinkSessionExternalTask = useAppStore((state) => state.unlinkSessionExternalTask);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlink = async (): Promise<void> => {
    setError(null);
    setIsUnlinking(true);
    try {
      await unlinkSessionExternalTask(sessionId, provider, externalId);
    } catch (unlinkError) {
      setError(formatError(unlinkError));
    } finally {
      setIsUnlinking(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-end">
        <GhostActionButton
          icon={Unlink}
          tone="danger"
          label="Unlink from session"
          isBusy={isUnlinking}
          busyLabel="Unlinking…"
          onClick={() => void unlink()}
        />
      </div>
      {error != null ? <p className="px-1 text-2xs text-danger">{error}</p> : null}
    </div>
  );
};
