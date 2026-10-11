import { useEffect, useMemo } from 'react';
import { Notice, formatError } from '@goodboy/ui';
import type { TerminalTab } from '../../../../shared/types/terminal';
import { LazyGenericTerminalPanel } from '../../../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel';
import { useAppStore } from '../../../../store';
import { createTerminalDriver } from '../../terminalDriver';
import { invokeTerminalOpen } from '../../terminal';

type Props = {
  readonly tab: TerminalTab;
  readonly isActive: boolean;
};

export const TerminalPane = ({ tab, isActive }: Props) => {
  const setTerminalTabStatus = useAppStore((s) => s.setTerminalTabStatus);
  const driver = useMemo(() => createTerminalDriver({ terminalId: tab.id }), [tab.id]);

  useEffect(() => {
    invokeTerminalOpen(tab.id, tab.cwd, 100, 24).catch((error: unknown) => {
      setTerminalTabStatus({
        owner: tab.owner,
        tabId: tab.id,
        status: 'exited',
        openError: formatError(error),
      });
    });
  }, [tab.id, tab.cwd, tab.owner, setTerminalTabStatus]);

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
      <div className="relative min-h-0 flex-1">
        <LazyGenericTerminalPanel
          key={tab.id}
          terminalId={tab.id}
          driver={driver}
          isActive={isActive}
          onExit={(exitCode) =>
            setTerminalTabStatus({ owner: tab.owner, tabId: tab.id, status: 'exited', exitCode })
          }
        />
      </div>
    </div>
  );
};
