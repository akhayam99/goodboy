import { useMemo } from 'react';
import { useAppStore } from '../../../../../store';
import type { AppState } from '../../../../../store/types';
import { CONTEXT_ROWS } from '../../../../../store/slices/contextDrawer/contextRows';
import { currentStack } from '../../../../../store/slices/navigation/currentStack';
import type {
  ContextDrawerSection,
  ContextDrawerView,
} from '../../../../../store/slices/drawer/state';

export type ContextFocus = {
  readonly section: ContextDrawerSection;
  readonly view: ContextDrawerView;
  readonly highlight: ReadonlyArray<number>;
};

type RowParams = {
  readonly state: AppState;
  readonly key: string;
};

type TextParams = {
  readonly row: string | null;
};

const NO_HIGHLIGHT: ReadonlyArray<number> = [];

const rowOf = ({ state, key }: RowParams): string | null => {
  const stack = currentStack(state);
  return stack.entries[stack.index]?.focus.returnRows?.[key] ?? null;
};

const sectionOf = ({ row }: TextParams): ContextDrawerSection => {
  if (row === 'decisions' || row === 'summary' || row === 'explanations') {
    return row;
  }
  return 'goal';
};

const highlightOf = ({ row }: TextParams): ReadonlyArray<number> => {
  if (row === null) {
    return NO_HIGHLIGHT;
  }
  return row
    .split(',')
    .map((part) => Number(part))
    .filter((number) => Number.isInteger(number));
};

export const useContextFocus = (): ContextFocus => {
  const section = useAppStore((state) => rowOf({ state, key: CONTEXT_ROWS.section }));
  const view = useAppStore((state) => rowOf({ state, key: CONTEXT_ROWS.view }));
  const highlight = useAppStore((state) => rowOf({ state, key: CONTEXT_ROWS.highlight }));
  return useMemo(
    () => ({
      section: sectionOf({ row: section }),
      view: view === 'versions' ? 'versions' : 'current',
      highlight: highlightOf({ row: highlight }),
    }),
    [highlight, section, view],
  );
};
