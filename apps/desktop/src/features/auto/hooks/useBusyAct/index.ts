import { useCallback, useState } from 'react';
import { useAppStore } from '../../../../store';

type Params<Port> = {
  readonly title: string;
  readonly notReadyMessage: string;
  readonly currentPort: () => Port | null;
};

type WorkParams<Port> = {
  readonly port: Port;
};

type RunParams<Port> = {
  readonly busyIds: ReadonlyArray<string>;
  readonly work: (params: WorkParams<Port>) => Promise<void>;
};

export type BusyActModel<Port> = Readonly<{
  busyIds: ReadonlyArray<string>;
  run: (params: RunParams<Port>) => Promise<void>;
}>;

export const useBusyAct = <Port>({
  title,
  notReadyMessage,
  currentPort,
}: Params<Port>): BusyActModel<Port> => {
  const reportError = useAppStore((state) => state.reportError);
  const [busyIds, setBusyIds] = useState<ReadonlyArray<string>>([]);

  const run = useCallback(
    async ({ busyIds: ids, work }: RunParams<Port>): Promise<void> => {
      const port = currentPort();
      if (port === null) {
        await reportError({ title, error: new Error(notReadyMessage) });
        return;
      }
      setBusyIds((current) => [...current, ...ids]);
      try {
        await work({ port });
      } catch (error) {
        await reportError({ title, error });
      } finally {
        setBusyIds((current) => current.filter((id) => !ids.includes(id)));
      }
    },
    [currentPort, notReadyMessage, reportError, title],
  );

  return { busyIds, run };
};
