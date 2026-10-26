import { useCallback, useEffect, useState } from 'react';
import { FLOATING_SURFACE, PopoverPortalProvider, Scrim, cn } from '@goodboy/ui';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { PALETTE_MODES } from '../../paletteModes';
import type { PaletteModeId } from '../../paletteModeTypes';
import { focusedPaletteScope } from '../../heldPaletteScope';
import { resolvePaletteScope } from '../../resolvePaletteScope';
import type { PaletteScope } from '../../types';
import { PALETTE_MIN_HEIGHT_PX } from '../CommandsMode/paletteBodyLayout';
import { ModeSwitch } from './ModeSwitch';

type Props = {
  readonly mode?: PaletteModeId;
  readonly initialQuery?: string;
  readonly onClose: () => void;
};

const scopeNow = (): PaletteScope | null => {
  const state = useAppStore.getState();
  const sessionId = state.currentSessionId as SessionId | null;
  const runId = sessionId === null ? null : (state.focusedWorkflowRunId[sessionId] ?? null);
  return resolvePaletteScope({
    currentWorkspaceId: state.currentWorkspaceId,
    currentSessionId: sessionId,
    selectedAgentId: sessionId === null ? null : (state.selectedAgentId[sessionId] ?? null),
    artifactConversationAgentId:
      sessionId === null ? null : (state.artifactConversationAgentId[sessionId] ?? null),
    lens: sessionId === null ? null : (state.activeLens[sessionId] ?? null),
    hasAppStudio: state.appStudio !== null,
    focusedRunId: runId as WorkflowRunId | null,
    prNumber: sessionId === null ? null : (state.sessionGithub[sessionId]?.pr?.number ?? null),
    heldScope: focusedPaletteScope(),
  });
};

const registered = (mode: PaletteModeId): PaletteModeId =>
  PALETTE_MODES.some((candidate) => candidate.id === mode) ? mode : 'commands';

export const PaletteOverlay = ({ mode = 'commands', initialQuery = '', onClose }: Props) => {
  const [modeId, setModeId] = useState<PaletteModeId>(() => registered(mode));
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<PaletteScope | null>(scopeNow);
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setModeId(registered(mode));
  }, [mode]);

  const active = PALETTE_MODES.find((candidate) => candidate.id === modeId) ?? PALETTE_MODES[0];
  const clearScope = useCallback(() => setScope(null), []);
  const switchMode = useCallback(() => {
    setModeId((current) => {
      const index = PALETTE_MODES.findIndex((candidate) => candidate.id === current);
      return PALETTE_MODES[(index + 1) % PALETTE_MODES.length]?.id ?? current;
    });
  }, []);

  if (active === undefined) {
    return null;
  }
  const Body = active.Body;

  return (
    <div
      ref={setLayer}
      className="fixed inset-0 z-command-palette flex items-start justify-center px-4 pt-14"
    >
      <Scrim testId="palette-scrim" onMouseDown={onClose} />
      <PopoverPortalProvider value={layer}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.label}
          style={{ minHeight: PALETTE_MIN_HEIGHT_PX }}
          className={cn(
            FLOATING_SURFACE,
            'relative flex max-h-[calc(100vh-7rem)] w-full flex-col overflow-hidden motion-safe:animate-studio-in',
            active.widthClass,
          )}
        >
          <Body
            query={query}
            onQueryChange={setQuery}
            scope={scope}
            onClearScope={clearScope}
            onSwitchMode={switchMode}
            onClose={onClose}
            modeSwitch={
              PALETTE_MODES.length > 1 ? (
                <ModeSwitch modes={PALETTE_MODES} value={modeId} onChange={setModeId} />
              ) : null
            }
          />
        </div>
      </PopoverPortalProvider>
    </div>
  );
};
