import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useOpenSession } from '../../../../shared/hooks/useOpenSession';
import { TerminalTabMenu } from '../../../actions/TerminalTabMenu';
import type { TerminalWorktree } from '../../terminalWorktrees';

type Props = {
  readonly worktree: TerminalWorktree;
};

export const TerminalStripActions = ({ worktree }: Props) => {
  const openSession = useOpenSession();
  const { path, sessionId } = worktree;
  if (path === null && sessionId === null) {
    return null;
  }
  return (
    <TerminalTabMenu
      label={`More on ${worktree.projectName}`}
      trigger={<CONCEPT_ICONS.more size={ICON_SIZE.control} aria-hidden />}
      facts={{
        path,
        isWorkspace: worktree.kind === 'workspace',
        sessionId,
        onOpenSession: () => {
          if (sessionId !== null) {
            openSession({ sessionId });
          }
        },
      }}
    />
  );
};
