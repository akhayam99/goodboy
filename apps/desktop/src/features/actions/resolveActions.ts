import { ACTION_GROUPS, type ActionDefinition, type ResolvedAction } from './types';

type Params<F> = {
  readonly definitions: ReadonlyArray<ActionDefinition<F>>;
  readonly facts: F;
};

const groupRank = ({ group }: { readonly group: ResolvedAction['group'] }): number =>
  ACTION_GROUPS.indexOf(group);

export const resolveOne = <F>({
  definition,
  facts,
}: {
  readonly definition: ActionDefinition<F>;
  readonly facts: F;
}): ResolvedAction => ({
  id: definition.id,
  label: typeof definition.label === 'string' ? definition.label : definition.label({ facts }),
  icon: definition.icon,
  group: definition.group,
  shortcut: definition.shortcut ?? null,
  description: definition.description?.({ facts }) ?? null,
  blockedReason: definition.blockedReason?.({ facts }) ?? null,
  confirm: definition.confirm?.({ facts }) ?? null,
  isUndoable: definition.isUndoable === true,
  choices: definition.choices?.({ facts }) ?? null,
  slot: definition.slot?.({ facts }) ?? 'menu',
});

export const resolveActions = <F>({
  definitions,
  facts,
}: Params<F>): ReadonlyArray<ResolvedAction> =>
  definitions
    .filter((definition) => definition.when({ facts }))
    .map((definition, index) => ({ resolved: resolveOne({ definition, facts }), index }))
    .sort(
      (a, b) =>
        groupRank({ group: a.resolved.group }) - groupRank({ group: b.resolved.group }) ||
        a.index - b.index,
    )
    .map(({ resolved }) => resolved);
