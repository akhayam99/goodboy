import type { AppStore } from '../../store/store';
import { resolveActions } from './resolveActions';
import { AGENT_KIND } from './kinds/agent';
import { ARTIFACT_KIND } from './kinds/artifact';
import { COMMIT_KIND } from './kinds/commit';
import { DIFF_KIND } from './kinds/diff';
import { DIFF_FILE_KIND } from './kinds/diffFile';
import { LINK_KIND } from './kinds/link';
import { PLAN_PART_KIND } from './kinds/planPart';
import { PULL_REQUEST_KIND } from './kinds/pullRequest';
import { MESSAGE_KIND } from './kinds/message';
import { MOUNT_KIND } from './kinds/mount';
import { PROJECT_KIND } from './kinds/project';
import { RECORD_KIND } from './kinds/record';
import { SCRIPT_KIND } from './kinds/script';
import { WORKTREE_KIND } from './kinds/worktree';
import { SESSION_KIND } from './kinds/session';
import { SESSIONS_KIND } from './kinds/sessions';
import { WORKFLOW_RUN_KIND } from './kinds/workflowRun';
import { REVIEW_KIND } from './kinds/review';
import { REVIEW_COMMENT_KIND } from './kinds/reviewComment';
import { WRITE_REVIEW_KIND } from './kinds/writeReview';
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
  ...(definition.adapted?.({ facts }) ?? []),
  ...definition.actions,
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
    case 'planPart':
      return bind({ definition: PLAN_PART_KIND, state, target });
    case 'artifact':
      return bind({ definition: ARTIFACT_KIND, state, target });
    case 'record':
      return bind({ definition: RECORD_KIND, state, target });
    case 'pullRequest':
      return bind({ definition: PULL_REQUEST_KIND, state, target });
    case 'diff':
      return bind({ definition: DIFF_KIND, state, target });
    case 'commit':
      return bind({ definition: COMMIT_KIND, state, target });
    case 'diffFile':
      return bind({ definition: DIFF_FILE_KIND, state, target });
    case 'mount':
      return bind({ definition: MOUNT_KIND, state, target });
    case 'project':
      return bind({ definition: PROJECT_KIND, state, target });
    case 'worktree':
      return bind({ definition: WORKTREE_KIND, state, target });
    case 'script':
      return bind({ definition: SCRIPT_KIND, state, target });
    case 'message':
      return bind({ definition: MESSAGE_KIND, state, target });
    case 'link':
      return bind({ definition: LINK_KIND, state, target });
    case 'review':
      return bind({ definition: REVIEW_KIND, state, target });
    case 'reviewComment':
      return bind({ definition: REVIEW_COMMENT_KIND, state, target });
    case 'writeReview':
      return bind({ definition: WRITE_REVIEW_KIND, state, target });
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
