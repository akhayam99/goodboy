import type { LensKind } from '../session-view/types';
import type { ContextDrawerTab } from '../drawer/state';

export const CONTEXT_LENS_TAB: Readonly<Partial<Record<LensKind, ContextDrawerTab | null>>> = {
  context: null,
  goal: 'goal',
  decisions: 'decisions',
  last_output_summary: 'summary',
};

type Params = {
  readonly lens: LensKind | null;
};

export const isContextLens = ({ lens }: Params): boolean =>
  lens !== null && CONTEXT_LENS_TAB[lens] !== undefined;
