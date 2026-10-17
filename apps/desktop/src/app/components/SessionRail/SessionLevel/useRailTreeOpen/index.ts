import { useCallback, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { STORAGE_KEYS, persistedPref } from '../../../../../shared/lib/storage-keys';

export type RailTreeNodeKind = 'project' | 'branch';

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
};

type SessionChoices = Readonly<Record<string, boolean>>;

type TreeChoices = Readonly<Record<string, SessionChoices>>;

const KEPT_SESSIONS = 50;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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
  const toggle = useCallback(
    ({ kind, id, isOpenByDefault }: RailTreeNode): void => {
      const key = nodeKey({ kind, id });
      const next = { ...choices, [key]: !(choices[key] ?? isOpenByDefault) };
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
  return { isOpen, toggle };
};
