import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WireframeAdjustment, WireframeDocument } from '@goodboy/core';
import { Button, cn, Eyebrow, SegmentedTabs, StudioDetailTabs } from '@goodboy/ui';
import type { WireframeArtifact } from '@goodboy/types';
import { postToFrame, type FrameMessage } from '../../frame/frameMessage';
import { useFrameMessages } from '../../useFrameMessages';
import { useFrameStage } from '../../useFrameStage';
import { buildWireframeIndex } from '../../wireframeIndex';
import { screenLinks, screenNodeNotes } from '../../wireframeNotes';
import { pageOfPath, screenPagePath, type WireframePage } from '../../wireframePagePath';
import { wireframeStageFiles } from '../../wireframeStageFiles';
import { NotesPanel } from './NotesPanel';
import { ScreenGrid } from './ScreenGrid';
import { ScreenRail } from './ScreenRail';
import { WireframeAdjustments } from './WireframeAdjustments';
import { WireframeFlowLegend } from './WireframeFlowLegend';
import { WireframeFlowOverview } from './WireframeFlowOverview';
import { WireframeStage, type WireframeZoom } from './WireframeStage';

export type WireframeView = 'flow' | 'screen';

const VIEW_OPTIONS = [
  { value: 'flow', label: 'Flow' },
  { value: 'screen', label: 'Screens' },
] satisfies ReadonlyArray<{ readonly value: WireframeView; readonly label: string }>;

const ZOOM_OPTIONS = [
  { value: 'fit', label: 'Fit' },
  { value: 'actual', label: '100%' },
] satisfies ReadonlyArray<{ readonly value: WireframeZoom; readonly label: string }>;

type Request = Readonly<{ page: WireframePage; nonce: number }>;

type Props = {
  readonly artifact: WireframeArtifact;
  readonly document: WireframeDocument;
  readonly adjustments: ReadonlyArray<WireframeAdjustment>;
  readonly onScreenChange?: (screenId: string | null) => void;
};

export const WireframeViewerBody = ({ artifact, document, adjustments, onScreenChange }: Props) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [view, setView] = useState<WireframeView>('flow');
  const [zoom, setZoom] = useState<WireframeZoom>('fit');
  const [isNotesOpen, setIsNotesOpen] = useState(true);
  const firstPage: WireframePage = { screenId: document.initialScreenId, state: null };
  const [request, setRequest] = useState<Request>({ page: firstPage, nonce: 0 });
  const [shown, setShown] = useState<WireframePage>(firstPage);
  const [contentHeight, setContentHeight] = useState(0);
  const index = useMemo(() => buildWireframeIndex({ document }), [document]);
  const stageKey = `${artifact.id}|${artifact.title}|${String(artifact.metadata.fidelity)}`;
  const stagedArtifact = useRef(artifact);
  stagedArtifact.current = artifact;
  const files = useMemo(
    () => wireframeStageFiles({ artifact: stagedArtifact.current, document }),
    [stageKey, document],
  );
  const stage = useFrameStage({ files });

  const screen =
    document.screens.find((entry) => entry.id === shown.screenId) ?? document.screens[0] ?? null;

  const open = useCallback((page: WireframePage) => {
    setView('screen');
    setShown(page);
    setRequest((previous) => ({ page, nonce: previous.nonce + 1 }));
  }, []);

  const onMessage = useCallback((message: FrameMessage) => {
    if (message.type !== 'navigated') {
      return;
    }
    setContentHeight(message.height);
    const page = pageOfPath({ path: message.path });
    if (page === null) {
      return;
    }
    setShown((previous) =>
      previous.screenId === page.screenId && previous.state === page.state ? previous : page,
    );
  }, []);
  useFrameMessages({ frameRef, onMessage });

  const currentScreenId = screen?.id ?? null;
  useEffect(() => {
    onScreenChange?.(view === 'screen' ? currentScreenId : null);
  }, [onScreenChange, view, currentScreenId]);

  const railEntries = useMemo(
    () => document.screens.map((entry) => ({ id: entry.id, title: entry.title, states: [] })),
    [document.screens],
  );
  const notes = useMemo(() => (screen === null ? [] : screenNodeNotes({ screen })), [screen]);
  const links = useMemo(
    () => (screen === null ? [] : screenLinks({ document, screen })),
    [document, screen],
  );

  return (
    <div
      data-testid="wireframe-viewer"
      data-view={view}
      className="@container flex min-w-0 flex-col gap-3"
    >
      <div data-testid="wireframe-toolbar" className="flex min-w-0 flex-wrap items-center gap-2">
        <StudioDetailTabs
          ariaLabel="Wireframe view"
          options={VIEW_OPTIONS}
          value={view}
          onChange={setView}
        />
        {view === 'screen' ? (
          <SegmentedTabs
            ariaLabel="Zoom"
            options={ZOOM_OPTIONS}
            value={zoom}
            onChange={setZoom}
            size="sm"
          />
        ) : (
          <WireframeFlowLegend />
        )}
        {view === 'screen' && !isNotesOpen ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsNotesOpen(true)}
            className="ml-auto"
          >
            Notes
          </Button>
        ) : null}
      </div>
      {stage.status === 'failed' ? (
        <span role="alert" className="text-secondary text-danger">
          The pages could not be shown: {stage.message}
        </span>
      ) : null}
      {view === 'flow' ? (
        <>
          <section aria-label="Flow" className="flex min-w-0 flex-col gap-2">
            <h2>
              <Eyebrow label="Flow" />
            </h2>
            <WireframeFlowOverview
              document={document}
              index={index}
              currentScreenId={shown.screenId}
              onSelectScreen={(screenId) => open({ screenId, state: null })}
            />
          </section>
          {stage.status === 'ready' ? (
            <ScreenGrid
              stageId={stage.stageId}
              screens={document.screens}
              currentScreenId={currentScreenId}
              onOpenScreen={(screenId) => open({ screenId, state: null })}
            />
          ) : null}
        </>
      ) : null}
      {view === 'screen' && screen !== null ? (
        <div
          data-testid="wireframe-screens"
          className={cn(
            'grid min-w-0 grid-cols-1 gap-4',
            isNotesOpen
              ? '@[1100px]:grid-cols-[200px_minmax(0,1fr)_260px]'
              : '@[1100px]:grid-cols-[200px_minmax(0,1fr)]',
          )}
        >
          <ScreenRail entries={railEntries} current={shown} onOpen={open} />
          {stage.status === 'ready' ? (
            <WireframeStage
              frameRef={frameRef}
              stageId={stage.stageId}
              path={screenPagePath(request.page)}
              loadKey={request.nonce}
              viewport={screen.viewport}
              zoom={zoom}
              contentHeight={contentHeight}
              title={`${screen.title} wireframe`}
            />
          ) : (
            <div data-testid="wireframe-stage-pending" className="min-h-40 rounded-md bg-subtle" />
          )}
          {isNotesOpen ? (
            <NotesPanel
              screenNote={screen.note ?? null}
              notes={notes}
              links={links}
              onReveal={(nodeId) =>
                postToFrame({ frame: frameRef.current, command: { type: 'reveal', nodeId } })
              }
              onOpenScreen={(screenId) => open({ screenId, state: null })}
              onClose={() => setIsNotesOpen(false)}
            />
          ) : null}
        </div>
      ) : null}
      <WireframeAdjustments adjustments={adjustments} />
    </div>
  );
};
