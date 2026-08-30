import { useState } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import type { CommentAgentArgs, ResolveModelChoice } from '../../../chat/spawn-from-comment';
import { useAppStore } from '../../../../store';

type SpawnParams = {
  readonly args: CommentAgentArgs;
  readonly choice: ResolveModelChoice;
  readonly deferKickoff: boolean;
};

type Params = {
  readonly sessionId: SessionId;
};

type Result = {
  readonly spawnedResolverIds: ReadonlyArray<AgentId>;
  readonly resetSpawnedResolverIds: () => void;
  readonly spawnResolver: (params: SpawnParams) => Promise<AgentId>;
};

export const useResolverSpawner = ({ sessionId }: Params): Result => {
  const spawnAgent = useAppStore((state) => state.spawnAgent);
  const setAgentConfig = useAppStore((state) => state.setAgentConfig);
  const [spawnedResolverIds, setSpawnedResolverIds] = useState<ReadonlyArray<AgentId>>([]);

  const spawnResolver = async ({ args, choice, deferKickoff }: SpawnParams): Promise<AgentId> => {
    const agentId = await spawnAgent(sessionId, {
      name: args.name,
      model: args.model,
      ...(args.provider !== undefined && { provider: args.provider }),
      effort: args.effort,
      initialPrompt: args.initialPrompt,
      kindOverride: args.kind,
      ...(args.sourceThreadId !== undefined && { sourceThreadId: args.sourceThreadId }),
      ...(args.sourceThreadIds !== undefined && { sourceThreadIds: args.sourceThreadIds }),
      sourceCommentUrl: args.sourceCommentUrl,
      sourceKind: args.sourceKind,
      ...(deferKickoff && { deferKickoff: true }),
      focus: 'none',
    });
    await setAgentConfig(sessionId, agentId, {
      ...(choice.provider !== undefined && { providerOverride: choice.provider }),
      ...(choice.model !== undefined && { modelOverride: choice.model }),
      effort: args.effort,
    });
    setSpawnedResolverIds((current) => [...current, agentId]);
    return agentId;
  };

  return {
    spawnedResolverIds,
    resetSpawnedResolverIds: () => setSpawnedResolverIds([]),
    spawnResolver,
  };
};
