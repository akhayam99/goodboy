import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type FactSlot = 'person' | 'weight' | 'place' | 'labels' | 'measure' | 'links' | 'time';

export const FACT_SLOTS: ReadonlyArray<FactSlot> = [
  'person',
  'weight',
  'place',
  'labels',
  'measure',
  'links',
  'time',
];

export type Fact = {
  readonly key: string;
  readonly label: string;
  readonly icon: LucideIcon | null;
  readonly node: ReactNode;
  readonly hint?: string;
};

export type ResolvedFact = Fact & {
  readonly slot: FactSlot;
};

type ResolveParams<T> = {
  readonly entity: T;
};

type FactResolver<T> = (params: ResolveParams<T>) => ReadonlyArray<Fact> | Fact | null;

export type FactRegistry<T> = Partial<Record<FactSlot, FactResolver<T>>>;
