import { useMemo } from 'react';
import type { Agent, SessionId } from '@goodboy/types';
import { Button } from '@goodboy/ui';
import { EMPTY_ARRAY, branchPlace, useAppStore } from '../../../../../store';
import { DockStateLine } from '../../../../../shared/components/DockStateLine';
import { useConversationAsks } from '../../../../../store/hooks/useConversationAsks';
import { glanceOf } from '../../../glance/glanceOf';
import { isReadOnlyAgent } from '../../../isReadOnlyAgent';
import { useWorktreeStatuses } from '../../../hooks/useWorktreeStatuses';
import { dockChangesOf } from '../dockChangesOf';

type Props = {
  readonly sessionId: SessionId;
  readonly agent: Agent;
};

const DONE_TONE = glanceOf({ state: 'done', sentence: '' }).tone;

export const AgentDockChanges = ({ sessionId, agent }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const mounts = useAppStore((state) => state.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY);
  const isReadOnly = isReadOnlyAgent({ agent });
  const mount =
    isReadOnly || agent.mountId === undefined
      ? undefined
      : mounts.find((candidate) => candidate.mountId === agent.mountId);
  const worktreePath = mount?.worktreePath ?? null;
  const targets = useMemo(
    () =>
      worktreePath === null ? [] : [{ worktreePath, baseBranch: mount?.baseBranch ?? undefined }],
    [mount?.baseBranch, worktreePath],
  );
  const statuses = useWorktreeStatuses({ targets });
  const { permissions, questions } = useConversationAsks({ sessionId, agentId: agent.id });
  const hasAsk = permissions.length > 0 || questions.length > 0;
  if (mount === undefined || worktreePath === null || hasAsk) {
    return null;
  }
  const sentence = dockChangesOf({
    status: statuses.get(worktreePath),
    branch: mount.branch ?? mount.mountName,
  });
  if (sentence === null) {
    return null;
  }
  return (
    <DockStateLine state="changes" tone={DONE_TONE} sentence={sentence}>
      <Button
        variant="primary"
        size="sm"
        onClick={() =>
          navigate({ to: branchPlace({ sessionId, mountPath: worktreePath, tab: 'files' }) })
        }
      >
        Review changes
      </Button>
    </DockStateLine>
  );
};
