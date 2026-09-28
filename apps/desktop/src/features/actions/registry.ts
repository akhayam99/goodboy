import type { AppStore } from '../../store/store';
import { resolveActions } from './resolveActions';
import { AGENT_KIND } from './kinds/agent';
import { LINK_KIND } from './kinds/link';
import { PULL_REQUEST_KIND } from './kinds/pullRequest';
import { SESSION_KIND } from './kinds/session';
import { SESSIONS_KIND } from './kinds/sessions';
import { WORKFLOW_RUN_KIND } from './kinds/workflowRun';
import type {
  ActionDefinition,
  ActionEnv,
  ObjectKindDefinition,
  ObjectTarget,
  ResolvedAction,
} from './types';

export type RunActionParams = {
  readonly actionId: string;
  readonly env: ActionEnv;
  readonly choice?: string | null;
};

export type BoundObject = {
  readonly noun: string;
  readonly facts: object;
  readonly resolve: () => ReadonlyArray<ResolvedAction>;
  readonly run: (params: RunActionParams) => Promise<void>;
};

type BindParams<T, F> = {
  readonly definition: ObjectKindDefinition<T, F>;
  readonly state: AppStore;
  readonly target: T;
};

export const definitionsFor = <T, F>({
  definition,
  facts,
}: {
  readonly definition: ObjectKindDefinition<T, F>;
  readonly facts: F;
}): ReadonlyArray<ActionDefinition<F>> => [
  ...definition.actions,
  ...(definition.adapted?.({ facts }) ?? []),
];

const bind = <T, F extends object>({
  definition,
  state,
  target,
}: BindParams<T, F>): BoundObject | null => {
  const facts = definition.facts({ state, target });
  if (facts === null) {
    return null;
  }
  const definitions = definitionsFor({ definition, facts });
  return {
    noun: definition.noun,
    facts,
    resolve: () => resolveActions({ definitions, facts }),
    run: async ({ actionId, env, choice = null }) => {
      const found = definitions.find((candidate) => candidate.id === actionId);
      if (found === undefined || !found.when({ facts })) {
        return;
      }
      if ((found.blockedReason?.({ facts }) ?? null) !== null) {
        return;
      }
      await found.run({ facts, env, choice });
    },
  };
};

type TargetParams = {
  readonly state: AppStore;
  readonly target: ObjectTarget;
};

export const bindTarget = ({ state, target }: TargetParams): BoundObject | null => {
  switch (target.kind) {
    case 'session':
      return bind({ definition: SESSION_KIND, state, target });
    case 'sessions':
      return bind({ definition: SESSIONS_KIND, state, target });
    case 'agent':
      return bind({ definition: AGENT_KIND, state, target });
    case 'workflowRun':
      return bind({ definition: WORKFLOW_RUN_KIND, state, target });
    case 'pullRequest':
      return bind({ definition: PULL_REQUEST_KIND, state, target });
    case 'link':
      return bind({ definition: LINK_KIND, state, target });
    default: {
      const exhaustive: never = target;
      return exhaustive;
    }
  }
};

type RunParams = RunActionParams & {
  readonly target: ObjectTarget;
};

export const runObjectAction = async ({ target, actionId, env, choice = null }: RunParams) => {
  await bindTarget({ state: env.getState(), target })?.run({ actionId, env, choice });
};
