import { AUTO_TREE_LIMITS, autoTreeCapUsd, isUsableMount } from '@goodboy/core';
import { listAutoAgentsWithoutTree } from '@goodboy/db';
import { brandId, type AutoTreeId, type SessionId } from '@goodboy/types';
import type { AgentVerbContext } from './verbContext';

const HOUR_MS = 60 * 60 * 1000;

export type SessionCapParams = Readonly<{ sessionId: SessionId }>;

export type WorkspaceLimitParams = Readonly<{ workspaceId: string }>;

export type StartAutoTreesParams = Readonly<{
  ctx: AgentVerbContext;
  sessionCapUsd: (params: SessionCapParams) => number | null;
  workspaceLimitUsd: (params: WorkspaceLimitParams) => Promise<number | null>;
}>;

export const startAutoTrees = async ({
  ctx,
  sessionCapUsd,
  workspaceLimitUsd,
}: StartAutoTreesParams): Promise<number> => {
  const agents = await listAutoAgentsWithoutTree({ db: ctx.db });
  let created = 0;
  for (const agent of agents) {
    const mounts = await ctx.ports.loadMounts({ sessionId: agent.sessionId });
    const nowMs = ctx.now();
    const outcome = await ctx.scheduler.createTree({
      id: brandId<AutoTreeId>({ value: ctx.ports.newId() }),
      rootAgentId: agent.agentId,
      sessionId: agent.sessionId,
      primaryMountId: mounts.find((mount) => isUsableMount({ mount }))?.id ?? null,
      capUsd: autoTreeCapUsd({
        sessionCapUsd: sessionCapUsd({ sessionId: agent.sessionId }),
        workspaceLimitUsd: await workspaceLimitUsd({ workspaceId: agent.workspaceId }),
      }),
      hardDeadlineAt: nowMs + AUTO_TREE_LIMITS.wallClockHours * HOUR_MS,
    });
    if (outcome.isCreated) {
      created += 1;
    }
  }
  return created;
};
