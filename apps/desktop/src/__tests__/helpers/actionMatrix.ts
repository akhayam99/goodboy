import { resolveActions } from '../../features/actions/resolveActions';
import type { ActionDefinition, ActionSlot, ResolvedAction } from '../../features/actions/types';

type Params<F> = {
  readonly definitions: ReadonlyArray<ActionDefinition<F>>;
  readonly facts: F;
};

const cell = ({ action }: { readonly action: ResolvedAction }): string =>
  action.blockedReason === null
    ? `${action.id} ${action.slot}`
    : `${action.id} ${action.slot} (${action.blockedReason})`;

export const matrixOf = <F>({ definitions, facts }: Params<F>): ReadonlyArray<string> =>
  resolveActions({ definitions, facts }).map((action) => cell({ action }));

export const slotCount = <F>({
  definitions,
  facts,
  slot,
}: Params<F> & { readonly slot: ActionSlot }): number =>
  resolveActions({ definitions, facts }).filter((action) => action.slot === slot).length;
