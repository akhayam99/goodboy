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

export type RecheckedRouting =
  | Readonly<{ kind: 'ready'; delegation: AutoDelegation }>
  | Readonly<{ kind: 'blocked'; code: string; message: string }>;

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
}: Params): Promise<RecheckedRouting> => {
  const { routing } = delegation;
  const unchanged: RecheckedRouting = { kind: 'ready', delegation };
  const failedStarts = await failedStartsOf({ ctx, tree, role });
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
    failedStarts,
  });
  const stored = textFieldOf({ source: routing, key: 'provider' });
  if (
    outcome.kind === 'blocked' &&
    stored !== null &&
    failedStarts.some((provider) => provider === stored)
  ) {
    return { kind: 'blocked', code: outcome.code, message: outcome.message };
  }
  if (
    outcome.kind !== 'ready' ||
    outcome.proposal !== 'replaced' ||
    outcome.cause == null ||
    !PROVIDER_CAUSES.includes(outcome.cause)
  ) {
    return unchanged;
  }
  const next = { ...routing, ...routingPickOf({ outcome }) };
  const patch = patchQueuedAutoDelegationRoutingStatement({
    delegationId: delegation.id,
    generation: tree.generation,
    routing: next,
  });
  const written = await ctx.db.execute(patch.sql, patch.params);
  return written.rowsAffected > 0
    ? { kind: 'ready', delegation: { ...delegation, routing: next } }
    : unchanged;
};
