import { useCallback, useState } from 'react';
import type { AgentId, Session, SessionId } from '@goodboy/types';
import { cn, useEscapeLayer, PaneBannerContext, PageTrailContext, PaneSwap } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import type { LensKind } from '../../../../store';
import { FirstLapBanner } from '../../../bootstrap/FirstLapBanner';
import { useAskOpenShortcut } from '../../ask/useAskOpenShortcut';
import { AgentOverlay } from './parts/AgentOverlay';
import { SessionLensPane } from './parts/SessionLensPane';
import { useSessionBranchSync } from '../../hooks/useSessionBranchSync';
import { resolveSessionSurfaceLayer } from '../../resolveSessionSurfaceLayer';
import { PresetRunPage } from '../PresetRun';
import { usePresetRunFocus } from '../../hooks/usePresetRunFocus';
import { useIsBranchlessSession } from '../../hooks/useIsBranchlessSession';
import { SIMPLE_LENSES } from '../../lens-labels';
import { resolveLensSurface, type LensSurface } from '../../lens-surface';
import { SessionBackRow } from './SessionBackRow';
import { foldedLensOf } from '../../../../store/slices/navigation/foldedLensOf';

const LENS_KEEP_ALIVE_CAP = 3;

type Props = {
  readonly session: Session;
};

export const SessionWorkspace = ({ session }: Props) => {
  const sessionId: SessionId = session.id;
  useSessionBranchSync({ session });
  useAskOpenShortcut({ sessionId });
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

  useEscapeLayer(leaveAgentOverlay, showAgentOverlay, true);

  const banner = <FirstLapBanner sessionId={sessionId} />;
  const trail = <SessionBackRow sessionId={sessionId} />;

  const lensLayers = keptSurfaces.map((target) => ({
    key: target,
    content: (
      <PageTrailContext.Provider value={showLens && target !== 'overview' ? trail : null}>
        <SessionLensPane session={session} target={target} isShown={showLens} />
      </PageTrailContext.Provider>
    ),
  }));

  return (
    <div className="@container relative flex h-full w-full min-w-0 flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col">
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
            <PageTrailContext.Provider value={trail}>
              <div className="absolute inset-0 z-20 flex flex-col bg-background">
                <PresetRunPage session={session} focus={runFocus} />
              </div>
            </PageTrailContext.Provider>
          </PaneBannerContext.Provider>
        ) : null}
        {showAgentOverlay ? (
          <PaneBannerContext.Provider value={banner}>
            <PageTrailContext.Provider value={trail}>
              <AgentOverlay
                session={session}
                sessionId={sessionId}
                isChatActive={selectedAgentId != null}
                selectedAgentId={selectedAgentId}
                onBack={leaveAgentOverlay}
              />
            </PageTrailContext.Provider>
          </PaneBannerContext.Provider>
        ) : null}
      </div>
    </div>
  );
};
