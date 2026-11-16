import type { AutoDelegationRole } from '@goodboy/core/auto';
import type { AutoTree, Database } from '@goodboy/db';
import { brandId, type WorkflowRoutingLock, type WorkspaceId } from '@goodboy/types';
import { readRunGuidance } from '../runGuidance/readRunGuidance';
import type { AgentGrant } from '../auto/ports';
import { readRunStepLock } from './readRunStepLock';

type Params = {
  readonly db: Database;
  readonly grant: Pick<AgentGrant, 'workspaceId'>;
  readonly tree: Pick<AutoTree, 'rootAgentId'>;
  readonly role: AutoDelegationRole;
};

export type LeadRunFacts = Readonly<{
  guidance: string | null;
  stepLock: WorkflowRoutingLock | null;
}>;

export const leadRunFactsOf = async ({ db, grant, tree, role }: Params): Promise<LeadRunFacts> => {
  const workspaceId = brandId<WorkspaceId>({ value: grant.workspaceId });
  const agentId = tree.rootAgentId;
  const [guidance, stepLock] = await Promise.all([
    readRunGuidance({ db, workspaceId, agentId }),
    readRunStepLock({ db, workspaceId, agentId, role }),
  ]);
  return { guidance, stepLock };
};
