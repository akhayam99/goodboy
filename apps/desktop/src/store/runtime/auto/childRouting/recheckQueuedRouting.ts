import type { AutoDelegationRole } from '@goodboy/core/auto';
import type { CandidateCause } from '@goodboy/core/providers';
import {
  patchQueuedAutoDelegationRoutingStatement,
  type AutoDelegation,
  type AutoTree,
} from '@goodboy/db';
import { isRecord } from '@goodboy/types/helpers';
import { textFieldOf } from '../../../../shared/utils/textFieldOf';
import type { AgentVerbContext } from '../verbContext';
import { routingPickOf } from './routingPickOf';
import { failedStartsOf } from './failedStartsOf';
import { writerFamilyOf } from './writerFamilyOf';

const PROVIDER_CAUSES: ReadonlyArray<CandidateCause> = [
  'off',
  'not-connected',
  'at-limit',
  'cooldown',
  'breaker',
  'budget',
  'outside-run',
  'failed-start',
];

type InputRefsParams = {
  readonly delegation: AutoDelegation;
};

const inputRefsOf = ({ delegation }: InputRefsParams) => {
  const inputs = delegation.request['inputArtifacts'];
  return (Array.isArray(inputs) ? inputs : []).flatMap((input: unknown) =>
    isRecord(input) &&
    typeof input['artifactId'] === 'string' &&
    typeof input['revision'] === 'number'
      ? [{ artifactId: input['artifactId'], revision: input['revision'] }]
      : [],
  );
};

type Params = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly delegation: AutoDelegation;
  readonly role: AutoDelegationRole;
};

export const recheckQueuedRouting = async ({
  ctx,
  tree,
  delegation,
  role,
}: Params): Promise<AutoDelegation> => {
  const { routing } = delegation;
  const writerFamily = await writerFamilyOf({
    ctx,
    tree,
    role,
    inputs: inputRefsOf({ delegation }),
  });
  const outcome = await ctx.ports.resolveRouting({
    sessionId: tree.sessionId,
    role,
    fields: {
      provider: textFieldOf({ source: routing, key: 'provider' }) ?? undefined,
      model: textFieldOf({ source: routing, key: 'model' }) ?? undefined,
      effort: textFieldOf({ source: routing, key: 'effort' }) ?? undefined,
      taskType: textFieldOf({ source: delegation.request, key: 'taskType' }) ?? undefined,
      difficulty: textFieldOf({ source: delegation.request, key: 'difficulty' }) ?? undefined,
    },
    promptText: textFieldOf({ source: delegation.request, key: 'task' }) ?? '',
    writerFamily,
    failedStarts: await failedStartsOf({ ctx, tree, role }),
  });
  if (
    outcome.kind !== 'ready' ||
    outcome.proposal !== 'replaced' ||
    outcome.cause == null ||
    !PROVIDER_CAUSES.includes(outcome.cause)
  ) {
    return delegation;
  }
  const next = { ...routing, ...routingPickOf({ outcome }) };
  const patch = patchQueuedAutoDelegationRoutingStatement({
    delegationId: delegation.id,
    generation: tree.generation,
    routing: next,
  });
  const written = await ctx.db.execute(patch.sql, patch.params);
  return written.rowsAffected > 0 ? { ...delegation, routing: next } : delegation;
};
