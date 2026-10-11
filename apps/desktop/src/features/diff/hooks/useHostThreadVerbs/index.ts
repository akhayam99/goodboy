import { useCallback, useState } from 'react';
import { formatError } from '@goodboy/ui';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import type { DiffComments, DiffThread } from '../../components/DiffView/types';

type Params = {
  readonly thread: DiffThread;
  readonly comments: DiffComments;
};

export type HostThreadVerbs = {
  readonly canReply: boolean;
  readonly canResolve: boolean;
  readonly canOpenInComments: boolean;
  readonly isReplying: boolean;
  readonly isBusy: boolean;
  readonly error: string | null;
  readonly openReply: () => void;
  readonly cancelReply: () => void;
  readonly sendReply: (body: string) => void;
  readonly resolve: () => void;
  readonly openInComments: () => void;
};

export const useHostThreadVerbs = ({ thread, comments }: Params): HostThreadVerbs => {
  const [isReplying, setIsReplying] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onReply, onResolve, onOpenInComments } = comments;
  const isHost = thread.source === 'host';
  const { id } = thread;

  const run = useCallback(async (verb: () => Promise<void>): Promise<boolean> => {
    setIsBusy(true);
    setError(null);
    try {
      await verb();
      return true;
    } catch (caught) {
      if (!isReportedError(caught)) {
        setError(formatError(caught));
      }
      return false;
    } finally {
      setIsBusy(false);
    }
  }, []);

  const sendReply = useCallback(
    (body: string): void => {
      if (onReply === undefined || isBusy) {
        return;
      }
      void run(() => onReply(id, body)).then((isDone) => {
        if (isDone) {
          setIsReplying(false);
        }
      });
    },
    [id, isBusy, onReply, run],
  );

  const resolve = useCallback((): void => {
    if (onResolve === undefined || isBusy) {
      return;
    }
    void run(() => onResolve(id));
  }, [id, isBusy, onResolve, run]);

  const openReply = useCallback((): void => {
    setError(null);
    setIsReplying(true);
  }, []);

  const cancelReply = useCallback((): void => {
    setError(null);
    setIsReplying(false);
  }, []);

  const openInComments = useCallback((): void => onOpenInComments?.(id), [id, onOpenInComments]);

  return {
    canReply: isHost && thread.canReply === true && onReply !== undefined,
    canResolve: isHost && thread.canResolve === true && onResolve !== undefined,
    canOpenInComments: isHost && onOpenInComments !== undefined,
    isReplying,
    isBusy,
    error,
    openReply,
    cancelReply,
    sendReply,
    resolve,
    openInComments,
  };
};
