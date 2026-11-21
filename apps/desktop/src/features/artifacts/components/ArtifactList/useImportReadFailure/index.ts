import { useCallback, useEffect, useRef } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { NOTHING_CHANGED } from '../../../../../store/slices/notifications/errorRecovery';

const IMPORT_FAILED = "Couldn't read the wireframe file";

type Importer = Readonly<{
  error: string | null;
  pending: unknown;
  cancel: () => void;
  pick: () => Promise<boolean>;
  readPath: (path: string) => Promise<boolean>;
}>;

type Params = {
  readonly importer: Importer;
  readonly sessionId: SessionId;
};

type ReadPathParams = {
  readonly path: string;
};

type ReadAgain = () => Promise<boolean>;

export const useImportReadFailure = ({ importer, sessionId }: Params) => {
  const { error, pending, cancel, pick, readPath } = importer;
  const lastRead = useRef<ReadAgain | null>(null);
  const retry = useCallback(() => lastRead.current?.() ?? Promise.resolve(false), []);

  useEffect(() => {
    if (pending !== null || error === null) {
      return;
    }
    void useAppStore.getState().reportError({
      title: IMPORT_FAILED,
      error,
      recovery: NOTHING_CHANGED,
      sessionId,
      retry,
    });
    cancel();
  }, [pending, error, cancel, retry, sessionId]);

  return {
    pick: () => {
      lastRead.current = pick;
      void pick();
    },
    readPath: ({ path }: ReadPathParams) => {
      lastRead.current = () => readPath(path);
      void readPath(path);
    },
  };
};
