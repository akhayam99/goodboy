import { useEffect, useState } from 'react';
import { TerminalStudio } from '../../../../../../features/terminal/components/TerminalStudio';
import { useAppStore } from '../../../../../../store';
import { useSceneClicks } from '../../audit/useSceneClicks';
import { mockSceneIpc } from '../../mockSceneIpc';
import { PageSheet } from '../../PageSheet';
import {
  DEV_TERMINAL,
  LEDGER_MOUNT,
  LEDGER_SESSION_ID,
  PAYMENTS_MOUNT,
  seedTerminalScene,
  terminalSceneAnswer,
} from './terminalSceneSeed';
import { C13_WORKSPACE_ID } from './workflowsSceneSeed';

type TerminalSceneState = 'list' | 'other' | 'menu' | 'workspace' | 'empty';

type Props = {
  readonly state: TerminalSceneState;
};

const noop = () => undefined;

const CLICK_MS = 250;

const clickLabelsOf = ({ state }: Props): ReadonlyArray<string> => {
  switch (state) {
    case 'menu':
      return ['More on payments-api'];
    case 'workspace':
      return ['harborline'];
    case 'list':
    case 'other':
    case 'empty':
      return [];
    default: {
      const unreachable: never = state;
      return unreachable;
    }
  }
};

const worktreeOf = ({ state }: Props): string | null => {
  if (state === 'empty') {
    return null;
  }
  return `${LEDGER_SESSION_ID}#m:${state === 'other' ? LEDGER_MOUNT : PAYMENTS_MOUNT}`;
};

export const TerminalScene = ({ state }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const studio = useAppStore((current) => current.appStudio);

  useEffect(() => {
    mockSceneIpc((command, payload) => terminalSceneAnswer({ command, payload }));
    seedTerminalScene({ hasTerminals: state !== 'empty' });
    useAppStore.getState().openStudio({
      studio: {
        kind: 'terminal',
        terminalId: state === 'list' || state === 'menu' ? DEV_TERMINAL : null,
        sessionId: LEDGER_SESSION_ID,
        worktree: worktreeOf({ state }),
      },
    });
    setIsReady(true);
  }, [state]);

  useSceneClicks({
    isReady,
    labels: clickLabelsOf({ state }),
    selector: 'button',
    match: 'prefix',
    intervalMs: CLICK_MS,
  });

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground">
      <PageSheet>
        <TerminalStudio
          workspaceId={C13_WORKSPACE_ID}
          terminalId={studio?.kind === 'terminal' ? studio.terminalId : null}
          sessionId={studio?.kind === 'terminal' ? studio.sessionId : LEDGER_SESSION_ID}
          worktree={studio?.kind === 'terminal' ? (studio.worktree ?? null) : null}
          onClose={noop}
        />
      </PageSheet>
    </main>
  );
};
