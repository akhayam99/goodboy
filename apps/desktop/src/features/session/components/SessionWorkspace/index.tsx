import { useCallback, useContext, useState } from 'react';
import type { AgentId, Session, SessionId } from '@goodboy/types';
import { cn, useEscapeLayer, PaneBannerContext, PaneSwap, UnderTrailContext } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import type { LensKind } from '../../../../store';
import { FirstLapBanner } from '../../../bootstrap/FirstLapBanner';
import { useAskOpenShortcut } from '../../ask/useAskOpenShortcut';
import { AskPane } from '../../ask/components/AskPane';
import { AgentOverlay } from './parts/AgentOverlay';
import { SessionLensPane } from './parts/SessionLensPane';
import { useSessionBranchSync } from '../../hooks/useSessionBranchSync';
import { resolveSessionSurfaceLayer } from '../../resolveSessionSurfaceLayer';
import { PresetRunPage } from '../PresetRun';
import { usePresetRunFocus } from '../../hooks/usePresetRunFocus';
import { useIsBranchlessSession } from '../../hooks/useIsBranchlessSession';
import { SIMPLE_LENSES } from '../../lens-labels';
import { resolveLensSurface, type LensSurface } from '../../lens-surface';
import { foldedLensOf } from '../../../../store/slices/navigation/foldedLensOf';
import { escapeLadder } from '../../escapeLadder';
import { SessionHeadContext } from '../../sessionHeadContext';
import { SessionHeadFrame } from '../SessionHeadFrame';
import { HeadSlotsGate } from '../HeadSlotsGate';

const LENS_KEEP_ALIVE_CAP = 3;

type Props = {
  readonly session: Session;
};

export const SessionWorkspace = ({ session }: Props) => {
  const sessionId: SessionId = session.id;
  useSessionBranchSync({ session });
  useAskOpenShortcut({ sessionId });
  const Head = useContext(SessionHeadContext);
  const isOuterUnderTrail = useContext(UnderTrailContext);
  const storedActiveLens = useAppStore((s) => s.activeLens[sessionId]);
  const isBranchless = useIsBranchlessSession({ session });
  const activeLens =
    isBranchless && storedActiveLens != null && !SIMPLE_LENSES.has(storedActiveLens)
      ? null
      : storedActiveLens;
  const up = useAppStore((s) => s.up);
  const selectedAgentId = useAppStore(
    (s) => s.selectedAgentId[sessionId] ?? null,
  ) as AgentId | null;
  const artifactConversationAgentId = useAppStore(
    (s) => s.artifactConversationAgentId[sessionId] ?? null,
  );

  const lens: LensKind | null = foldedLensOf({ lens: activeLens ?? null });
  const surface = resolveLensSurface({ lens });
  const [visitedSurfaces, setVisitedSurfaces] = useState<ReadonlyArray<LensSurface>>([surface]);
  const keptSurfaces = visitedSurfaces.includes(surface)
    ? visitedSurfaces
    : [...visitedSurfaces, surface].slice(-LENS_KEEP_ALIVE_CAP);
  if (keptSurfaces !== visitedSurfaces) {
    setVisitedSurfaces(keptSurfaces);
  }
  const runFocus = usePresetRunFocus({ sessionId });
  const surfaceLayer = resolveSessionSurfaceLayer({
    lens,
    selectedAgentId,
    artifactConversationAgentId,
    hasRunFocus: runFocus !== null,
  });
  const showAgentOverlay = surfaceLayer === 'agent';
  const showLens = surfaceLayer === 'lens';
  const leaveAgentOverlay = useCallback(() => up(), [up]);
  const isCurrent = useAppStore((s) => s.currentSessionId === sessionId);

  useEscapeLayer(() => escapeLadder({}), isCurrent, true);

  const banner = <FirstLapBanner sessionId={sessionId} />;

  const lensLayers = keptSurfaces.map((target) => ({
    key: target,
    content: (
      <HeadSlotsGate isOpen={showLens && target === surface}>
        <SessionLensPane session={session} target={target} isShown={showLens} />
      </HeadSlotsGate>
    ),
  }));

  const body = (
    <UnderTrailContext.Provider value={isOuterUnderTrail || Head !== null}>
      <div data-session-body="" className="relative flex min-h-0 flex-1 gap-3">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            className={cn('absolute inset-0 z-0', !showLens && 'invisible pointer-events-none')}
            inert={!showLens}
          >
            <PaneBannerContext.Provider value={showAgentOverlay ? null : banner}>
              <PaneSwap activeKey={surface} layers={lensLayers} shouldFocusTitle={showLens} />
            </PaneBannerContext.Provider>
          </div>

          {surfaceLayer === 'run' && runFocus !== null ? (
            <PaneBannerContext.Provider value={banner}>
              <div className="absolute inset-0 z-20 flex flex-col bg-background">
                <PresetRunPage session={session} focus={runFocus} />
              </div>
            </PaneBannerContext.Provider>
          ) : null}
          {showAgentOverlay ? (
            <PaneBannerContext.Provider value={banner}>
              <AgentOverlay
                session={session}
                sessionId={sessionId}
                isChatActive={selectedAgentId != null}
                selectedAgentId={selectedAgentId}
                onBack={leaveAgentOverlay}
              />
            </PaneBannerContext.Provider>
          ) : null}
        </div>
      </div>
    </UnderTrailContext.Provider>
  );
  const page =
    Head === null ? (
      <div className="@container relative flex h-full w-full min-w-0 flex-col gap-2">{body}</div>
    ) : (
      <SessionHeadFrame head={<Head session={session} />}>{body}</SessionHeadFrame>
    );
  return (
    <div data-session-dock-row="" className="relative flex h-full w-full min-w-0">
      <div className="relative isolate flex h-full min-w-0 flex-1 flex-col">{page}</div>
      <AskPane session={session} />
    </div>
  );
};
