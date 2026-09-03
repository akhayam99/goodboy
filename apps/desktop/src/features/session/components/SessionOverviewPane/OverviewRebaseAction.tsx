import { useMemo } from 'react';
import { formatError } from '@goodboy/ui';
import type { SessionProjectMount } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { SessionSuggestion } from '../../../suggestions';
import { SuggestionRow } from '../../../suggestions/components/SuggestionRow';
import { useWorktreeStatuses } from '../../hooks/useWorktreeStatuses';
import { useRebaseAgent } from '../../hooks/useRebaseAgent';

type Props = {
  readonly suggestion: Extract<SessionSuggestion, { readonly kind: 'rebase-project' }>;
  readonly mount: SessionProjectMount | null;
};

export const OverviewRebaseAction = ({ suggestion, mount }: Props) => {
  const setSessionActiveProject = useAppStore((state) => state.setSessionActiveProject);
  const emitNotification = useAppStore((state) => state.emitNotification);
  const targets = useMemo(
    () =>
      mount == null
        ? []
        : [{ worktreePath: mount.worktreePath, baseBranch: suggestion.payload.baseBranch }],
    [mount, suggestion.payload.baseBranch],
  );
  const statuses = useWorktreeStatuses({ targets });
  const status = mount == null ? null : (statuses.get(mount.worktreePath) ?? null);
  const rebase = useRebaseAgent({
    sessionId: suggestion.sessionId,
    status,
    onError: (message) => {
      void emitNotification('error', 'error', 'Rebase failed', formatError(message), {
        sessionId: suggestion.sessionId,
      });
    },
  });
  const runRebase = async () => {
    await setSessionActiveProject({
      sessionId: suggestion.sessionId,
      projectId: suggestion.payload.projectId,
    });
    await rebase.run();
  };
  return (
    <SuggestionRow
      suggestion={suggestion}
      size="row"
      actionLabel={rebase.isRunning ? 'Rebasing' : 'Rebase'}
      isDisabled={!rebase.canRebase || rebase.isRunning}
      onAction={() => void runRebase()}
    />
  );
};
