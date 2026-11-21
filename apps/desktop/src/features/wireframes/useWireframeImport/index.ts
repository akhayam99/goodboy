import { useCallback, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { WireframeImport } from '../importWireframeJson';
import { pickWireframeFile, readWireframeFile } from '../readWireframeFile';

type ReadyWireframeImport = Extract<WireframeImport, Readonly<{ status: 'ready' }>>;

type Params = {
  readonly commit: (ready: ReadyWireframeImport) => Promise<void>;
};

export type WireframeImportHandle = Readonly<{
  pending: WireframeImport | null;
  isBusy: boolean;
  error: string | null;
  pick: () => Promise<boolean>;
  readPath: (path: string) => Promise<boolean>;
  confirm: () => void;
  cancel: () => void;
}>;

export const useWireframeImport = ({ commit }: Params): WireframeImportHandle => {
  const [pending, setPending] = useState<WireframeImport | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((read: () => Promise<WireframeImport | null>) => {
    setError(null);
    return read()
      .then((next) => setPending((current) => next ?? current))
      .then(() => true)
      .catch((cause: unknown) => {
        setError(formatError(cause));
        return false;
      });
  }, []);

  const confirm = useCallback(() => {
    if (pending === null || pending.status !== 'ready' || isBusy) {
      return;
    }
    setIsBusy(true);
    setError(null);
    commit(pending)
      .then(() => setPending(null))
      .catch((cause: unknown) => setError(formatError(cause)))
      .finally(() => setIsBusy(false));
  }, [commit, isBusy, pending]);

  return {
    pending,
    isBusy,
    error,
    pick: () => load(pickWireframeFile),
    readPath: (path) => load(() => readWireframeFile({ path })),
    confirm,
    cancel: () => {
      setPending(null);
      setError(null);
    },
  };
};
