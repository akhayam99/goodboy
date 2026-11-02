import type { ReactNode } from 'react';
import { startSettingsUsedBy, type StartFormKind, type StartSettingKey } from './startFormKinds';

export type StartSettingItem = Readonly<{
  key: StartSettingKey;
  node: ReactNode;
  isChanged: boolean;
}>;

type StartSettingNodes = Readonly<Partial<Record<StartSettingKey, ReactNode>>>;

type Params = {
  readonly kind: StartFormKind | null;
  readonly nodes: StartSettingNodes;
  readonly changed: ReadonlyArray<StartSettingKey>;
};

export const startSettingsOf = ({
  kind,
  nodes,
  changed,
}: Params): ReadonlyArray<StartSettingItem> => {
  return startSettingsUsedBy({ kind }).flatMap((key): ReadonlyArray<StartSettingItem> => {
    const node = nodes[key];
    return node === undefined || node === null
      ? []
      : [{ key, node, isChanged: changed.includes(key) }];
  });
};
