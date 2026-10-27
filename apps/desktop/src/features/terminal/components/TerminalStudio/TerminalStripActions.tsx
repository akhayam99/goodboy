import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { ICON_SIZE } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { TerminalTab } from '../../../../shared/types/terminal';
import { useTerminalOutputHandoff } from '../../hooks/useTerminalOutputHandoff';
import { useOpenSession } from '../../../../shared/hooks/useOpenSession';
import { TerminalTabMenu } from '../../../actions/TerminalTabMenu';
import { ObjectMenuOrVerb } from '../../../actions/ObjectMenuOrVerb';
import type { TerminalTabFacts } from '../../../actions/kinds/terminalTab';
import type { TerminalWorktree } from '../../terminalWorktrees';

type Props = {
  readonly worktree: TerminalWorktree;
  readonly tab: TerminalTab;
  readonly handoffSessionId: SessionId | null;
  readonly canOpenSession?: boolean;
};

export const TerminalStripActions = ({
  worktree,
  tab,
  handoffSessionId,
  canOpenSession = true,
}: Props) => {
  const openSession = useOpenSession();
  const handoff = useTerminalOutputHandoff({
    sessionId: handoffSessionId,
    tab,
    projectName: worktree.projectName,
    branch: worktree.branch,
  });
  const { path } = worktree;
  const sessionId = canOpenSession ? worktree.sessionId : null;
  if (path === null && sessionId === null && !handoff.canHandOff) {
    return null;
  }
  const facts: TerminalTabFacts = {
    path,
    isWorkspace: worktree.kind === 'workspace',
    sessionId,
    onOpenSession: () => {
      if (sessionId !== null) {
        openSession({ sessionId });
      }
    },
    ...(handoff.canHandOff && {
      sendOutput: {
        label: 'Send last output',
        blockedReason: null,
        onSend: handoff.sendLastOutput,
      },
    }),
  };
  return (
    <ObjectMenuOrVerb
      target={{ kind: 'terminalTab', facts }}
      menu={
        <TerminalTabMenu
          label={`More on ${worktree.projectName}`}
          trigger={<CONCEPT_ICONS.more size={ICON_SIZE.control} aria-hidden />}
          facts={facts}
        />
      }
    />
  );
};
