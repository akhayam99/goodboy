import type { SessionId } from '@goodboy/types';
import { Button, Kbd, KeyHint } from '@goodboy/ui';
import { AskTrailButton } from '../../../../../../features/session/ask/components/AskTrailButton';
import { CommandCenter } from '../../../../AppTopBar/CommandCenter';
import { SceneFrame } from './SceneFrame';
import { SceneRow } from './SceneRow';

const SESSION_ID = 'mock-controls-session-ledger-export' as SessionId;

export const ControlsHintsScene = () => (
  <SceneFrame>
    <SceneRow name="Ask and Search side by side">
      <div className="@container/topbar flex w-full items-center gap-4">
        <AskTrailButton sessionId={SESSION_ID} />
        <CommandCenter />
      </div>
    </SceneRow>
    <SceneRow name="Filled button with a single key">
      <Button size="sm" variant="primary">
        Fix 3
        <KeyHint keys="F" onTone />
      </Button>
      <Button size="sm" variant="primary">
        Start Scout
        <KeyHint keys="⌘↵" onTone />
      </Button>
    </SceneRow>
    <SceneRow name="Quiet button with a single key">
      <Button size="sm" variant="ghost">
        Cancel
        <KeyHint keys="Esc" />
      </Button>
      <Button size="sm" variant="secondary">
        Queue
        <KeyHint keys="↵" />
      </Button>
    </SceneRow>
    <SceneRow name="Menu row hint">
      <div className="flex w-64 items-center justify-between gap-3 rounded-md bg-hover px-3 py-1 text-label text-foreground">
        <span>Rename</span>
        <Kbd look="inline">R</Kbd>
      </div>
      <div className="flex w-64 items-center justify-between gap-3 rounded-md px-3 py-1 text-label text-foreground">
        <span>Link work</span>
        <Kbd look="inline">L</Kbd>
      </div>
    </SceneRow>
  </SceneFrame>
);
