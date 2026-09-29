import {
  ACTION_GROUPS,
  type ActionDefinition,
  type ActionViewing,
  type ResolvedAction,
} from './types';

type Params<F> = {
  readonly definitions: ReadonlyArray<ActionDefinition<F>>;
  readonly facts: F;
  readonly viewing?: ActionViewing | null;
};

const groupRank = ({ group }: { readonly group: ResolvedAction['group'] }): number =>
  ACTION_GROUPS.indexOf(group);

const resolveOne = <F>({
  definition,
  facts,
}: {
  readonly definition: ActionDefinition<F>;
  readonly facts: F;
}): ResolvedAction => {
  const label =
    typeof definition.label === 'string' ? definition.label : definition.label({ facts });
  return {
    id: definition.id,
    label,
    shortLabel: definition.shortLabel?.({ facts }) ?? label,
    icon: definition.icon,
    group: definition.group,
    slot: definition.slot?.({ facts }) ?? 'menu',
    pendingLabel: definition.pendingLabel?.({ facts }) ?? null,
    shortcut: definition.shortcut ?? null,
    description: definition.description?.({ facts }) ?? null,
    blockedReason: definition.blockedReason?.({ facts }) ?? null,
    confirm: definition.confirm?.({ facts }) ?? null,
    isUndoable: definition.isUndoable === true,
    choices: definition.choices?.({ facts }) ?? null,
    isBusy: definition.isBusy?.({ facts }) ?? false,
  };
};

export const resolveActions = <F>({
  definitions,
  facts,
  viewing = null,
}: Params<F>): ReadonlyArray<ResolvedAction> =>
  definitions
    .filter((definition) => definition.when({ facts, viewing }))
    .map((definition, index) => ({ resolved: resolveOne({ definition, facts }), index }))
    .sort(
      (a, b) =>
        groupRank({ group: a.resolved.group }) - groupRank({ group: b.resolved.group }) ||
        a.index - b.index,
    )
    .map(({ resolved }) => resolved);
