import { useEffect } from 'react';
import type { TerminalTab } from '../../../../shared/types/terminal';
import { useAppStore } from '../../../../store';
import { terminalOutputBus } from '../../outputBus';

type Params = {
  readonly tabs: ReadonlyArray<TerminalTab>;
};

export const useTerminalExitWatch = ({ tabs }: Params): void => {
  const setTerminalTabStatus = useAppStore((s) => s.setTerminalTabStatus);

  useEffect(() => {
    let isCurrent = true;
    const stops: Array<() => void> = [];
    void terminalOutputBus.register().then(() => {
      if (!isCurrent) {
        return;
      }
      for (const tab of tabs) {
        stops.push(
          terminalOutputBus.subscribe({
            terminalId: tab.id,
            subscriber: {
              onExit: (exitCode) =>
                setTerminalTabStatus({
                  owner: tab.owner,
                  tabId: tab.id,
                  status: 'exited',
                  exitCode,
                }),
            },
          }),
        );
      }
    });
    return () => {
      isCurrent = false;
      for (const stop of stops) {
        stop();
      }
    };
  }, [tabs, setTerminalTabStatus]);
};
