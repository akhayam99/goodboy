import { useEffect, useState } from 'react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { ScriptsPanel } from '../../../../../features/scripts/components/ScriptsPanel';
import {
  SCRIPTS_LIVE_SESSION_ID,
  SCRIPTS_LIVE_WORKSPACE_ID,
  advanceDevOutput,
  scriptsLiveInvoke,
  seedScriptsLive,
  type ScriptsLiveVariant,
} from './scriptsLiveSeed';

const ADVANCE_MS = 2_000;

type Props = {
  readonly variant: ScriptsLiveVariant;
};

export const ScriptsLiveStage = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    Reflect.set(window, '__TAURI_INTERNALS__', {
      invoke: (command: string) => scriptsLiveInvoke({ command }),
    });
    seedScriptsLive({ variant });
    setIsReady(true);
    if (variant !== 'running') {
      return undefined;
    }
    let tick = 0;
    const timer = window.setInterval(() => {
      tick += 1;
      advanceDevOutput({ tick });
    }, ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [variant]);

  if (!isReady) {
    return null;
  }

  return (
    <ToastProvider>
      <main
        data-testid={`scripts-live-${variant}`}
        className="h-screen overflow-hidden bg-background p-4 text-foreground"
      >
        <ScriptsPanel workspaceId={SCRIPTS_LIVE_WORKSPACE_ID} sessionId={SCRIPTS_LIVE_SESSION_ID} />
      </main>
    </ToastProvider>
  );
};
