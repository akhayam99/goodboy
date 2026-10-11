import { useEffect, useMemo } from 'react';
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
    void invokeTerminalOpen(tab.id, tab.cwd, 100, 24);
  }, [tab.id, tab.cwd]);

  return (
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
  );
};
