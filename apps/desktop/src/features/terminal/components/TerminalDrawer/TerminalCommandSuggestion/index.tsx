import type { MountId, Session } from '@goodboy/types';
import type { TerminalTab } from '../../../../../shared/types/terminal';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { useSessionSuggestions } from '../../../../suggestions';
import { terminalCommandMoveOf } from '../../../terminalCommandMoveOf';
import { TerminalCommandRunner } from '../TerminalCommandRunner';

type Props = {
  readonly session: Session;
  readonly mountId: MountId;
  readonly tab: TerminalTab;
  readonly isTabBusy: boolean;
};

const NO_IDS: ReadonlySet<string> = new Set();

export const TerminalCommandSuggestion = ({ session, mountId, tab, isTabBusy }: Props) => {
  const agents = useAppStore((state) => state.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);
  const moves = useSessionSuggestions({ session, agents, withRebase: false });
  if (terminalCommandMoveOf({ moves, mountId, hiddenIds: NO_IDS }) === null) {
    return null;
  }
  return (
    <TerminalCommandRunner
      session={session}
      agents={agents}
      moves={moves}
      mountId={mountId}
      tab={tab}
      isTabBusy={isTabBusy}
    />
  );
};
