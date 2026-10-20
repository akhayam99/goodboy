import { useCallback, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { currentPublishPort, type PublishAct } from '../../publishPort';

const FAILED_TITLE = "Couldn't finish the push";

type ActParams = {
  readonly act: PublishAct;
  readonly delegationIds: ReadonlyArray<string>;
  readonly sessionId: SessionId;
};

export type PublishActModel = Readonly<{
  busyIds: ReadonlyArray<string>;
  act: (params: ActParams) => Promise<void>;
}>;

export const usePublishAct = (): PublishActModel => {
  const reportError = useAppStore((state) => state.reportError);
  const loadAutoTrees = useAppStore((state) => state.loadAutoTrees);
  const [busyIds, setBusyIds] = useState<ReadonlyArray<string>>([]);

  const act = useCallback(
    async ({ act: name, delegationIds, sessionId }: ActParams): Promise<void> => {
      const port = currentPublishPort();
      if (port === null) {
        await reportError({
          title: FAILED_TITLE,
          error: new Error('Auto is not running yet. Try again in a moment.'),
        });
        return;
      }
      setBusyIds((current) => [...current, ...delegationIds]);
      try {
        const result = await port({ act: name, delegationIds });
        for (const row of result.rows) {
          if ((row.state === 'failed' || row.state === 'refused') && row.message !== null) {
            await reportError({ title: FAILED_TITLE, error: new Error(row.message) });
          }
        }
        await loadAutoTrees({ sessionId });
      } catch (error) {
        await reportError({ title: FAILED_TITLE, error });
      } finally {
        setBusyIds((current) => current.filter((id) => !delegationIds.includes(id)));
      }
    },
    [loadAutoTrees, reportError],
  );

  return { busyIds, act };
};
