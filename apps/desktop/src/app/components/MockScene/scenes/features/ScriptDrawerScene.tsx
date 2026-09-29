import { useEffect, useState } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { ScriptRunDrawer } from '../../../../../features/scripts/components/ScriptRunDrawer';
import { ScriptsLensScene } from '../SurfaceAuditScenes';

const SESSION_ID = 'mock-scripts-session-settlement' as SessionId;
const MOUNT_ID = 'mock-scripts-mount-ledger' as MountId;
const SCRIPT_KEY = 'mock-scripts-script-posting-drift';
const SEED_DELAY_MS = 600;

const noop = () => undefined;

export const FeaturesScriptDrawerScene = () => {
  const [isSeeded, setIsSeeded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsSeeded(true), SEED_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex h-screen bg-background">
      <div className="min-w-0 flex-1">
        <ScriptsLensScene />
      </div>
      <aside className="h-screen w-[580px] shrink-0 border-l border-border-soft">
        {isSeeded ? (
          <ScriptRunDrawer
            sessionId={SESSION_ID}
            scriptKey={SCRIPT_KEY}
            mountId={MOUNT_ID}
            onClose={noop}
          />
        ) : null}
      </aside>
    </div>
  );
};
