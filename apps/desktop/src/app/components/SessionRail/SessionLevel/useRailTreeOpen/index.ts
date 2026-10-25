import { useCallback, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';
import { STORAGE_KEYS, persistedPref } from '../../../../../shared/lib/storage-keys';

type RailTreeNodeKind = 'project' | 'branch' | 'finished';

type Params = {
  readonly sessionId: SessionId;
};

export type RailTreeNode = {
  readonly kind: RailTreeNodeKind;
  readonly id: string;
  readonly isOpenByDefault: boolean;
};

export type RailTreeOpen = {
  readonly isOpen: (node: RailTreeNode) => boolean;
  readonly toggle: (node: RailTreeNode) => void;
  readonly open: (node: RailTreeNode) => void;
};

type SessionChoices = Readonly<Record<string, boolean>>;

type TreeChoices = Readonly<Record<string, SessionChoices>>;

const KEPT_SESSIONS = 50;

const choicesOf = (value: unknown): SessionChoices | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
    ),
  );
};

const treeChoicesPref = persistedPref<TreeChoices>({
  key: STORAGE_KEYS.sessionRailTreeOpen,
  parse: (raw) => {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return undefined;
    }
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([sessionId, value]) => {
        const choices = choicesOf(value);
        return choices === undefined ? [] : [[sessionId, choices]];
      }),
    );
  },
  fallback: {},
});

type WriteParams = {
  readonly key: string;
  readonly isNowOpen: boolean;
};

type KeyParams = Pick<RailTreeNode, 'kind' | 'id'>;

const nodeKey = ({ kind, id }: KeyParams): string => `${kind}:${id}`;

export const useRailTreeOpen = ({ sessionId }: Params): RailTreeOpen => {
  const [choices, setChoices] = useState<SessionChoices>(
    () => treeChoicesPref.read()[sessionId] ?? {},
  );
  const isOpen = useCallback(
    ({ kind, id, isOpenByDefault }: RailTreeNode): boolean =>
      choices[nodeKey({ kind, id })] ?? isOpenByDefault,
    [choices],
  );
  const write = useCallback(
    ({ key, isNowOpen }: WriteParams): void => {
      const next = { ...choices, [key]: isNowOpen };
      const others = Object.entries(treeChoicesPref.read()).filter(
        ([otherId]) => otherId !== sessionId,
      );
      treeChoicesPref.write(
        Object.fromEntries([...others.slice(-(KEPT_SESSIONS - 1)), [sessionId, next]]),
      );
      setChoices(next);
    },
    [choices, sessionId],
  );
  const toggle = useCallback(
    ({ kind, id, isOpenByDefault }: RailTreeNode): void => {
      const key = nodeKey({ kind, id });
      write({ key, isNowOpen: !(choices[key] ?? isOpenByDefault) });
    },
    [choices, write],
  );
  const open = useCallback(
    ({ kind, id }: RailTreeNode): void => write({ key: nodeKey({ kind, id }), isNowOpen: true }),
    [write],
  );
  return { isOpen, toggle, open };
};
