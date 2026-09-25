import { beatResolvePublication, claimResolvePublication } from '@goodboy/db';
import type { ResolvePublication } from '@goodboy/types';
import { currentWindowLabel } from '../../../features/workspace/window';
import { tauriDatabase } from '../../../shared/lib/db';

export const PUBLICATION_HEARTBEAT_MS = 10_000;
export const PUBLICATION_STALE_MS = 60_000;

const LAUNCH_ID = crypto.randomUUID();

export const publicationHolder = (): string => `${currentWindowLabel()}:${LAUNCH_ID}`;

type StaleParams = {
  readonly publication: ResolvePublication;
  readonly now: number;
};

export const isPublicationStale = ({ publication, now }: StaleParams): boolean => {
  const lastSign = publication.heartbeatAt ?? publication.confirmedAt ?? publication.createdAt;
  return now - lastSign > PUBLICATION_STALE_MS;
};

type StartParams = {
  readonly publicationId: string;
};

export const startPublicationHeartbeat = async ({
  publicationId,
}: StartParams): Promise<() => void> => {
  const holder = publicationHolder();
  await claimResolvePublication({ db: tauriDatabase, id: publicationId, holder, now: Date.now() });
  const timer = setInterval(() => {
    void beatResolvePublication({
      db: tauriDatabase,
      id: publicationId,
      holder,
      now: Date.now(),
    }).catch(() => undefined);
  }, PUBLICATION_HEARTBEAT_MS);
  return () => clearInterval(timer);
};
