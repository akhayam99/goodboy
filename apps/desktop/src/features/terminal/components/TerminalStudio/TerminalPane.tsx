import { useEffect, useMemo } from 'react';
import { Notice, formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { TerminalTab } from '../../../../shared/types/terminal';
import { LazyGenericTerminalPanel } from '../../../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel';
import { useAppStore } from '../../../../store';
import { createTerminalDriver } from '../../terminalDriver';
import { openTerminalOnce } from '../../openTerminalOnce';
import { useTerminalFileLinks } from '../../hooks/useTerminalFileLinks';
import { useTerminalOutputHandoff } from '../../hooks/useTerminalOutputHandoff';
import { EndedCommandStrip } from './EndedCommandStrip';

type Props = {
  readonly tab: TerminalTab;
  readonly isActive: boolean;
  readonly sessionId?: SessionId | null;
  readonly projectName?: string | null;
  readonly branch?: string | null;
};

export const TerminalPane = ({
  tab,
  isActive,
  sessionId = null,
  projectName = null,
  branch = null,
}: Props) => {
  const handoff = useTerminalOutputHandoff({ sessionId, tab, projectName, branch });
  const setTerminalTabStatus = useAppStore((s) => s.setTerminalTabStatus);
  const driver = useMemo(() => createTerminalDriver({ terminalId: tab.id }), [tab.id]);
  const onOpenFileLink = useTerminalFileLinks({ tab });
  const endedCommand = useAppStore((s) =>
    tab.isRestored === true ? (s.endedWork?.terminals[tab.id] ?? null) : null,
  );
  const dismissEndedTerminal = useAppStore((s) => s.dismissEndedTerminal);

  useEffect(() => {
    if (tab.status === 'exited') {
      return;
    }
    let isCancelled = false;
    openTerminalOnce({ id: tab.id, cwd: tab.cwd, owner: tab.owner }).catch((error: unknown) => {
      if (isCancelled) {
        return;
      }
      setTerminalTabStatus({
        owner: tab.owner,
        tabId: tab.id,
        status: 'exited',
        openError: formatError(error),
      });
    });
    return () => {
      isCancelled = true;
    };
  }, [tab.id, tab.cwd, tab.owner, tab.status, tab.prefill, setTerminalTabStatus]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {tab.openError === undefined ? null : (
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title="Couldn't open this terminal"
          body={tab.openError}
        />
      )}
      {endedCommand === null ? null : (
        <EndedCommandStrip
          command={endedCommand}
          onRunAgain={() => {
            driver.write(`${endedCommand}\r`);
            dismissEndedTerminal({ terminalId: tab.id });
          }}
          onDismiss={() => dismissEndedTerminal({ terminalId: tab.id })}
        />
      )}
      <div className="relative min-h-0 flex-1">
        <LazyGenericTerminalPanel
          key={tab.id}
          terminalId={tab.id}
          driver={driver}
          isActive={isActive}
          {...(handoff.canHandOff && {
            selectionAction: { label: handoff.askLabel, onAct: handoff.sendSelection },
          })}
          onOpenFileLink={onOpenFileLink}
        />
      </div>
    </div>
  );
};
