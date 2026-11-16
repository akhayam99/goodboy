import { useState } from 'react';

type Params = {
  readonly keys: ReadonlyArray<string>;
};

type MoveParams = {
  readonly delta: number;
};

type TaskPickerCursor = {
  readonly activeKey: string | null;
  readonly setActiveKey: (key: string | null) => void;
  readonly move: (params: MoveParams) => void;
};

export const useTaskPickerCursor = ({ keys }: Params): TaskPickerCursor => {
  const [pinnedKey, setActiveKey] = useState<string | null>(null);
  const activeKey = pinnedKey !== null && keys.includes(pinnedKey) ? pinnedKey : (keys[0] ?? null);

  const move = ({ delta }: MoveParams): void => {
    if (keys.length === 0) {
      return;
    }
    const from = activeKey === null ? 0 : keys.indexOf(activeKey);
    const next = Math.min(keys.length - 1, Math.max(0, from + delta));
    setActiveKey(keys[next] ?? null);
  };

  return { activeKey, setActiveKey, move };
};
