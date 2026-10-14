import { effectiveApproval, sha256Hex } from '@goodboy/core';
import {
  getAutoArtifact,
  getAutoDelegation,
  getAutoTree,
  listAutoDelegations,
  readAutoArtifactLiveState,
} from '@goodboy/db';
import { brandId, type ArtifactId, type AutoDelegationId } from '@goodboy/types';
import type { AgentCommand, BridgeOutcome } from './ports';
import { refuseOutcome } from './refuseOutcome';
import { treeBudget } from './treeBudget';
import type { AgentVerbContext } from './verbContext';

export type AgentStatusParams = Readonly<{
  ctx: AgentVerbContext;
  command: AgentCommand;
}>;

type TextParams = {
  readonly value: unknown;
};

const textOf = ({ value }: TextParams): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const readArtifact = async ({
  ctx,
  command,
  artifactId,
}: AgentStatusParams & { readonly artifactId: string }): Promise<BridgeOutcome> => {
  const id = brandId<ArtifactId>({ value: artifactId });
  const registered = await getAutoArtifact({ db: ctx.db, artifactId: id });
  const live = await readAutoArtifactLiveState({ db: ctx.db, artifactId: id });
  if (registered === null || registered.treeId !== command.grant.treeId || live === null) {
    return refuseOutcome({ code: 'artifact_unknown' });
  }
  return {
    isOk: true,
    data: {
      artifactId,
      kind: registered.kind,
      title: live.title,
      revision: live.revision,
      status: live.status,
      approval: effectiveApproval({
        approvalState: registered.approvalState,
        approvedRevision: registered.approvedRevision,
        revision: live.revision,
        openReviseDelegationId: registered.openReviseDelegationId,
      }),
      contentHash: sha256Hex(live.sourceText),
      body: live.sourceText,
    },
  };
};

const readDelegation = async ({
  ctx,
  command,
  delegationId,
}: AgentStatusParams & { readonly delegationId: string }): Promise<BridgeOutcome> => {
  const delegation = await getAutoDelegation({
    db: ctx.db,
    delegationId: brandId<AutoDelegationId>({ value: delegationId }),
  });
  if (delegation === null || delegation.treeId !== command.grant.treeId) {
    return refuseOutcome({ code: 'delegation_unknown' });
  }
  return {
    isOk: true,
    data: {
      delegationId,
      role: delegation.role,
      childAgentId: delegation.childAgentId,
      state: delegation.state,
      outcome: delegation.outcome,
      reason: delegation.reason,
      result: delegation.result,
    },
  };
};

export const agentStatus = async ({ ctx, command }: AgentStatusParams): Promise<BridgeOutcome> => {
  const artifactId = textOf({ value: command.args['artifact'] });
  if (artifactId !== null) {
    return readArtifact({ ctx, command, artifactId });
  }
  const delegationId = textOf({ value: command.args['delegation'] });
  if (delegationId !== null) {
    return readDelegation({ ctx, command, delegationId });
  }
  const tree = await getAutoTree({ db: ctx.db, treeId: command.grant.treeId });
  if (tree === null) {
    return refuseOutcome({ code: 'not_owner' });
  }
  const budget = await treeBudget({ db: ctx.db, treeId: tree.id });
  const delegations = await listAutoDelegations({ db: ctx.db, treeId: tree.id });
  return {
    isOk: true,
    data: {
      phase: tree.phase,
      generation: tree.generation,
      budget: budget === null ? null : budget.promptLine,
      delegations: delegations.map((delegation) => ({
        delegationId: delegation.id,
        role: delegation.role,
        childAgentId: delegation.childAgentId,
        state: delegation.state,
        outcome: delegation.outcome,
      })),
    },
  };
};
