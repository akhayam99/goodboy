import type { AppStore } from '../../../store/store';
import { AGENT_KIND } from './agentKind';
import { SESSION_KIND } from './sessionKind';
import {
  ACTION_GROUPS,
  type ActionDefinition,
  type ActionEnv,
  type ObjectKindDefinition,
  type ObjectTarget,
  type ResolvedAction,
} from './types';

export type RunActionParams = {
  readonly actionId: string;
  readonly env: ActionEnv;
};

export type BoundObject = {
  readonly noun: string;
  readonly facts: object;
  readonly resolve: () => ReadonlyArray<ResolvedAction>;
  readonly run: (params: RunActionParams) => Promise<void>;
};

type ResolveParams<F> = {
  readonly definitions: ReadonlyArray<ActionDefinition<F>>;
  readonly facts: F;
};

type BindParams<T, F> = {
  readonly definition: ObjectKindDefinition<T, F>;
  readonly state: AppStore;
  readonly target: T;
};

type TargetParams = {
  readonly state: AppStore;
  readonly target: ObjectTarget;
};

type RunParams = RunActionParams & {
  readonly target: ObjectTarget;
};

export const resolveActions = <F>({
  definitions,
  facts,
}: ResolveParams<F>): ReadonlyArray<ResolvedAction> =>
  definitions
    .filter((definition) => definition.when({ facts }))
    .map((definition, index) => ({ definition, index }))
    .sort(
      (a, b) =>
        ACTION_GROUPS.indexOf(a.definition.group) - ACTION_GROUPS.indexOf(b.definition.group) ||
        a.index - b.index,
    )
    .map(({ definition }) => ({
      id: definition.id,
      label: definition.label,
      icon: definition.icon,
      group: definition.group,
      shortcut: definition.shortcut ?? null,
      description: null,
      blockedReason: definition.blockedReason?.({ facts }) ?? null,
      confirm: definition.confirm?.({ facts }) ?? null,
      isUndoable: definition.isUndoable === true,
    }));

const bind = <T, F extends object>({
  definition,
  state,
  target,
}: BindParams<T, F>): BoundObject | null => {
  const facts = definition.facts({ state, target });
  if (facts === null) {
    return null;
  }
  return {
    noun: definition.noun,
    facts,
    resolve: () => resolveActions({ definitions: definition.actions, facts }),
    run: async ({ actionId, env }) => {
      const found = definition.actions.find((candidate) => candidate.id === actionId);
      if (found === undefined || !found.when({ facts })) {
        return;
      }
      if ((found.blockedReason?.({ facts }) ?? null) !== null) {
        return;
      }
      await found.run({ facts, env });
    },
  };
};

export const bindTarget = ({ state, target }: TargetParams): BoundObject | null => {
  switch (target.kind) {
    case 'session':
      return bind({ definition: SESSION_KIND, state, target });
    case 'agent':
      return bind({ definition: AGENT_KIND, state, target });
    default: {
      const exhaustive: never = target;
      return exhaustive;
    }
  }
};

export const runObjectAction = async ({ target, actionId, env }: RunParams): Promise<void> => {
  await bindTarget({ state: env.getState(), target })?.run({ actionId, env });
};
