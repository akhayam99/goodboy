import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { NOTHING_CHANGED } from '../../../../store/slices/notifications/errorRecovery';
import { rowSaves } from './rowSaves';

type ValueParams<Value> = {
  readonly value: Value;
};

export type SettingWrite<Value> = (params: ValueParams<Value>) => Promise<void>;

type Params<Value> = {
  readonly rowKey: string;
  readonly saved: Value;
  readonly write: SettingWrite<Value>;
  readonly display: (params: ValueParams<Value>) => string;
  readonly failureTitle: string;
  readonly workspaceId?: WorkspaceId;
};

type Attempt<Value> = ValueParams<Value> & {
  readonly write: SettingWrite<Value>;
};

export type SettingSave<Value> = {
  readonly value: Value;
  readonly isSaving: boolean;
  readonly error: string | null;
  readonly save: (params: ValueParams<Value>) => Promise<void>;
  readonly retry: () => Promise<void>;
};

const noRetry = async (): Promise<void> => undefined;

export const useSettingSave = <Value>({
  rowKey,
  saved,
  write,
  display,
  failureTitle,
  workspaceId,
}: Params<Value>): SettingSave<Value> => {
  const reportError = useAppStore((state) => state.reportError);
  const [pending, setPending] = useState<ValueParams<Value> | null>(null);
  const sent = useRef(0);
  const isMounted = useRef(true);
  const failure = useSyncExternalStore(
    (listener) => rowSaves.subscribe({ listener }),
    () => rowSaves.failureOf({ key: rowKey }),
  );

  useEffect(() => {
    isMounted.current = true;
    rowSaves.open({ key: rowKey });
    return () => {
      isMounted.current = false;
      rowSaves.close({ key: rowKey });
    };
  }, [rowKey]);

  const send = useCallback(
    async ({ value, write: target }: Attempt<Value>): Promise<void> => {
      const claim = rowSaves.latest.claim({ key: rowKey });
      sent.current += 1;
      const mine = sent.current;
      const settle = () => {
        if (isMounted.current && sent.current === mine) {
          setPending(null);
        }
      };
      setPending({ value });
      rowSaves.clear({ key: rowKey });
      try {
        await rowSaves.writes.run({ key: rowKey, task: () => target({ value }) });
      } catch (error) {
        settle();
        if (!claim.isCurrent()) {
          return;
        }
        if (!rowSaves.isOpen({ key: rowKey })) {
          void reportError({ recovery: NOTHING_CHANGED, title: failureTitle, error, workspaceId });
          return;
        }
        rowSaves.fail({
          key: rowKey,
          failure: { value, retry: () => send({ value, write: target }) },
        });
        return;
      }
      settle();
    },
    [failureTitle, reportError, rowKey, workspaceId],
  );

  const save = useCallback(
    ({ value }: ValueParams<Value>) => send({ value, write }),
    [send, write],
  );

  return {
    value: pending === null ? saved : pending.value,
    isSaving: pending !== null,
    error: failure === null ? null : `Couldn't save. Still ${display({ value: saved })}.`,
    save,
    retry: failure === null ? noRetry : failure.retry,
  };
};
