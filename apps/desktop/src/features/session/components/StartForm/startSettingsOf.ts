import type { ReactNode } from 'react';
import { startSettingsUsedBy, type StartFormKind, type StartSettingKey } from './startFormKinds';

export type StartSettingWords = Readonly<{
  lead: string;
  value: string;
}>;

export type StartSettingItem = Readonly<{
  key: StartSettingKey;
  node: ReactNode;
  isChanged: boolean;
  words: StartSettingWords | null;
}>;

type StartSettingNodes = Readonly<Partial<Record<StartSettingKey, ReactNode>>>;

type StartSettingWordsByKey = Readonly<Partial<Record<StartSettingKey, StartSettingWords | null>>>;

type Params = {
  readonly kind: StartFormKind | null;
  readonly nodes: StartSettingNodes;
  readonly words: StartSettingWordsByKey;
  readonly changed: ReadonlyArray<StartSettingKey>;
};

export const startSettingsOf = ({
  kind,
  nodes,
  words,
  changed,
}: Params): ReadonlyArray<StartSettingItem> => {
  return startSettingsUsedBy({ kind }).flatMap((key): ReadonlyArray<StartSettingItem> => {
    const node = nodes[key];
    return node === undefined || node === null
      ? []
      : [{ key, node, isChanged: changed.includes(key), words: words[key] ?? null }];
  });
};
