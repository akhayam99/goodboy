import type { AgentId, RoleModelPreferences } from '@goodboy/types';
import type { ResolveModelChoice } from '../../../../chat/spawn-from-comment';
import type { CommentThread } from '../../../comment-threads';
import type { ResolverLink } from '../../../../session/resolver-linkage';
import { ResolveThreadsBoard } from '../../../../session/resolve/ResolveThreadsBoard';

type Props = {
  readonly threads: ReadonlyArray<CommentThread>;
  readonly resolverFor?: (thread: CommentThread) => ResolverLink | undefined;
  readonly onSpawnOne: (thread: CommentThread, choice: ResolveModelChoice) => void;
  readonly onSpawnBatch: (
    threads: ReadonlyArray<CommentThread>,
    choiceById: Readonly<Record<string, ResolveModelChoice>>,
  ) => void;
  readonly onSpawnCombined: (
    threads: ReadonlyArray<CommentThread>,
    choice: ResolveModelChoice,
  ) => void;
  readonly onOpenResolver?: (agentId: AgentId) => void;
  readonly onOpenThread: (threadId: string) => void;
  readonly roleModels: RoleModelPreferences | null;
};

export const ResolveBoard = (props: Props) => <ResolveThreadsBoard {...props} />;
