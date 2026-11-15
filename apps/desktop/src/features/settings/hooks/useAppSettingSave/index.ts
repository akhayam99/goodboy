import { useCallback } from 'react';
import { useAppStore } from '../../../../store';
import { settingRowKey } from '../../settingRowKey';
import { useSettingSave, type SettingSave } from '../useSettingSave';

type ValueParams<Value> = {
  readonly value: Value;
};

type Params<Value> = {
  readonly settingKey: string;
  readonly saved: Value;
  readonly encode: (params: ValueParams<Value>) => string;
  readonly display: (params: ValueParams<Value>) => string;
  readonly failureTitle: string;
};

export const useAppSettingSave = <Value>({
  settingKey,
  saved,
  encode,
  display,
  failureTitle,
}: Params<Value>): SettingSave<Value> => {
  const saveSetting = useAppStore((state) => state.saveSetting);
  const write = useCallback(
    ({ value }: ValueParams<Value>) => saveSetting(settingKey, encode({ value })),
    [encode, saveSetting, settingKey],
  );
  return useSettingSave({
    rowKey: settingRowKey({ workspaceId: null, row: settingKey }),
    saved,
    write,
    display,
    failureTitle,
  });
};
