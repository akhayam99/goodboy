import { Button } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useCopyText } from '../../../../shared/hooks/useCopyText';
import { useOpenSession } from '../../../../shared/hooks/useOpenSession';
import { TerminalTabMenu } from '../../../actions/TerminalTabMenu';
import type { TerminalWorktree } from '../../terminalWorktrees';

type Props = {
  readonly worktree: TerminalWorktree;
};

export const TerminalStripActions = ({ worktree }: Props) => {
  const copy = useCopyText();
  const openSession = useOpenSession();
  const { path, sessionId } = worktree;
  const isWorkspace = worktree.kind === 'workspace';
  if (path !== null && sessionId !== null) {
    return (
      <TerminalTabMenu
        label={`More on ${worktree.projectName}`}
        trigger={<CONCEPT_ICONS.more size={ICON_SIZE.control} aria-hidden />}
        facts={{ path, isWorkspace, sessionId, onOpenSession: () => openSession({ sessionId }) }}
      />
    );
  }
  if (path !== null) {
    return (
      <Button size="xs" variant="quiet" onClick={() => void copy({ text: path })}>
        {isWorkspace ? 'Copy folder path' : 'Copy worktree path'}
      </Button>
    );
  }
  if (sessionId !== null) {
    return (
      <Button size="xs" variant="quiet" onClick={() => openSession({ sessionId })}>
        Open session
      </Button>
    );
  }
  return null;
};
