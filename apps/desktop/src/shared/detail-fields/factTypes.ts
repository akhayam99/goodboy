import type { ReactNode } from 'react';
import type { IconGlyph } from '@goodboy/ui/icons';

export type FactSlot =
  'state' | 'person' | 'weight' | 'place' | 'labels' | 'measure' | 'links' | 'time';

export const FACT_SLOTS: ReadonlyArray<FactSlot> = [
  'state',
  'weight',
  'person',
  'place',
  'labels',
  'links',
  'measure',
  'time',
];

type FactEditorParams = {
  readonly close: () => void;
};

export type Fact = {
  readonly key: string;
  readonly label: string;
  readonly icon: IconGlyph | null;
  readonly node: ReactNode;
  readonly hint?: string;
  readonly editor?: (params: FactEditorParams) => ReactNode;
};

export type ResolvedFact = Fact & {
  readonly slot: FactSlot;
};

type ResolveParams<T> = {
  readonly entity: T;
};

type FactResolver<T> = (params: ResolveParams<T>) => ReadonlyArray<Fact> | Fact | null;

export type FactRegistry<T> = Partial<Record<FactSlot, FactResolver<T>>>;
