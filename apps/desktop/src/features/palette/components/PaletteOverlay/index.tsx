import { useCallback, useEffect, useState } from 'react';
import { cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { PALETTE_MODES } from '../../paletteModes';
import type { PaletteModeId } from '../../paletteModeTypes';
import { focusedPaletteScope } from '../../heldPaletteScope';
import { resolvePaletteScope } from '../../resolvePaletteScope';
import type { PaletteScope } from '../../types';
import { ModeSwitch } from './ModeSwitch';

type Props = {
  readonly mode?: PaletteModeId;
  readonly initialQuery?: string;
  readonly onClose: () => void;
};

const scopeNow = (): PaletteScope | null => {
  const state = useAppStore.getState();
  const sessionId = state.currentSessionId as SessionId | null;
  return resolvePaletteScope({
    currentWorkspaceId: state.currentWorkspaceId,
    currentSessionId: sessionId,
    selectedAgentId: sessionId === null ? null : (state.selectedAgentId[sessionId] ?? null),
    hasStudio: sessionId !== null && (state.sessionStudio[sessionId] ?? null) !== null,
    heldScope: focusedPaletteScope(),
  });
};

const registered = (mode: PaletteModeId): PaletteModeId =>
  PALETTE_MODES.some((candidate) => candidate.id === mode) ? mode : 'commands';

export const PaletteOverlay = ({ mode = 'commands', initialQuery = '', onClose }: Props) => {
  const [modeId, setModeId] = useState<PaletteModeId>(() => registered(mode));
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<PaletteScope | null>(scopeNow);

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
    <div className="fixed inset-0 z-command-palette flex items-start justify-center px-4 pt-16">
      <div
        aria-hidden
        data-testid="palette-scrim"
        className="absolute inset-0 bg-scrim motion-safe:animate-fade-in"
        onMouseDown={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={active.label}
        className={cn(
          'relative flex max-h-[calc(100vh-8rem)] w-full flex-col overflow-hidden rounded-lg border border-border bg-floating shadow-lg motion-safe:animate-studio-in',
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
    </div>
  );
};
