import { useEffect, useMemo } from 'react';
import { Notice, formatError } from '@goodboy/ui';
import type { TerminalTab } from '../../../../shared/types/terminal';
import { LazyGenericTerminalPanel } from '../../../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel';
import { useAppStore } from '../../../../store';
import { createTerminalDriver } from '../../terminalDriver';
import { openTerminalOnce } from '../../openTerminalOnce';

type Props = {
  readonly tab: TerminalTab;
  readonly isActive: boolean;
};

export const TerminalPane = ({ tab, isActive }: Props) => {
  const setTerminalTabStatus = useAppStore((s) => s.setTerminalTabStatus);
  const driver = useMemo(() => createTerminalDriver({ terminalId: tab.id }), [tab.id]);

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
      <div className="relative min-h-0 flex-1">
        <LazyGenericTerminalPanel
          key={tab.id}
          terminalId={tab.id}
          driver={driver}
          isActive={isActive}
        />
      </div>
    </div>
  );
};
