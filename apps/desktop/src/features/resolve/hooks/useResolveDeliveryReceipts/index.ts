import { useEffect, useState } from 'react';
import { listResolvePublicationThreads } from '@goodboy/db';
import type { ResolvePublication, ResolvePublicationThread } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';

const EMPTY_RECEIPTS: ReadonlyArray<ResolvePublicationThread> = [];

type Params = {
  readonly publications: ReadonlyArray<ResolvePublication>;
};

export const useResolveDeliveryReceipts = ({
  publications,
}: Params): ReadonlyArray<ResolvePublicationThread> => {
  const [receipts, setReceipts] = useState<ReadonlyArray<ResolvePublicationThread>>(EMPTY_RECEIPTS);
  useEffect(() => {
    if (publications.length === 0) {
      setReceipts(EMPTY_RECEIPTS);
      return;
    }
    let cancelled = false;
    Promise.all(
      publications.map(({ id: publicationId }) =>
        listResolvePublicationThreads({ db: tauriDatabase, publicationId }).catch(() => []),
      ),
    )
      .then((groups) => {
        if (!cancelled) {
          setReceipts(groups.flat());
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [publications]);

  return receipts;
};
