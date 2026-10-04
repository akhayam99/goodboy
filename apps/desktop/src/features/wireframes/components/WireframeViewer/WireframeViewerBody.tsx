import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  walkWireframeNodes,
  type WireframeAdjustment,
  type WireframeDocument,
  type WireframeNode,
  type WireframeScreen,
} from '@goodboy/core';
import { Button, cn, Eyebrow, SegmentedTabs, StudioDetailTabs } from '@goodboy/ui';
import type { WireframeArtifact } from '@goodboy/types';
import { postToFrame, type FrameMessage } from '../../frame/frameMessage';
import { useFrameMessages } from '../../useFrameMessages';
import { useFrameStage } from '../../useFrameStage';
import { buildWireframeIndex } from '../../wireframeIndex';
import { screenLinks, screenNodeNotes } from '../../wireframeNotes';
import { pageOfPath, screenPagePath, type WireframePage } from '../../wireframePagePath';
import type { WireframePickedNode } from '../../buildWireframeChangeRequest';
import { wireframeNodeLabel } from '../../wireframeNodeLabel';
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

const DEFAULT_STATE = 'default';

const stateOptions = ({
  screen,
}: {
  readonly screen: WireframeScreen;
}): ReadonlyArray<Readonly<{ id: string; label: string }>> => {
  const entries = Object.entries(screen.states ?? {});
  if (entries.length === 0) {
    return [];
  }
  return [
    { id: DEFAULT_STATE, label: 'Default' },
    ...entries.map(([id, state]) => ({ id, label: state.label })),
  ];
};

const nodeLabelOf = ({
  document,
  nodeId,
}: {
  readonly document: WireframeDocument;
  readonly nodeId: string;
}): string | null => {
  let found: WireframeNode | null = null;
  for (const screen of document.screens) {
    walkWireframeNodes({
      node: screen.root,
      visit: (node) => {
        if (node.id === nodeId) {
          found = node;
        }
      },
    });
  }
  return found === null ? null : wireframeNodeLabel({ node: found });
};

type Props = {
  readonly artifact: WireframeArtifact;
  readonly document: WireframeDocument;
  readonly adjustments: ReadonlyArray<WireframeAdjustment>;
  readonly onScreenChange?: (screenId: string | null) => void;
  readonly stageTitle?: string;
  readonly revisionKey?: number;
  readonly leading?: ReactNode;
  readonly banner?: ReactNode;
  readonly renderComposer?: (screen: WireframeScreen) => ReactNode;
  readonly isPicking?: boolean;
  readonly onPicked?: (node: WireframePickedNode) => void;
  readonly onPickEnded?: () => void;
};

export const WireframeViewerBody = ({
  artifact,
  document,
  adjustments,
  onScreenChange,
  stageTitle,
  revisionKey = 0,
  leading,
  banner,
  renderComposer,
  isPicking = false,
  onPicked,
  onPickEnded,
}: Props) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [view, setView] = useState<WireframeView>('flow');
  const [zoom, setZoom] = useState<WireframeZoom>('fit');
  const [isNotesOpen, setIsNotesOpen] = useState(true);
  const firstPage: WireframePage = { screenId: document.initialScreenId, state: null };
  const [request, setRequest] = useState<Request>({ page: firstPage, nonce: 0 });
  const [shown, setShown] = useState<WireframePage>(firstPage);
  const [contentHeight, setContentHeight] = useState(0);
  const variants = document.variants ?? [];
  const [variant, setVariant] = useState<string | null>(variants[0]?.id ?? null);
  const variantRef = useRef(variant);
  variantRef.current = variant;
  const index = useMemo(() => buildWireframeIndex({ document }), [document]);
  const title = stageTitle ?? artifact.title;
  const stageKey = `${artifact.id}|${title}|${String(artifact.metadata.fidelity)}`;
  const stagedArtifact = useRef(artifact);
  stagedArtifact.current = { ...artifact, title };
  const files = useMemo(
    () => wireframeStageFiles({ artifact: stagedArtifact.current, document }),
    [stageKey, document],
  );
  const pickingRef = useRef(isPicking);
  pickingRef.current = isPicking;
  const pickHandlers = useRef({ onPicked, onPickEnded, document });
  pickHandlers.current = { onPicked, onPickEnded, document };
  useEffect(() => {
    postToFrame({ frame: frameRef.current, command: { type: 'pick', isOn: isPicking } });
  }, [isPicking]);
  const stage = useFrameStage({ files });

  const screen =
    document.screens.find((entry) => entry.id === shown.screenId) ?? document.screens[0] ?? null;

  const open = useCallback((page: WireframePage) => {
    setView('screen');
    setShown(page);
    setRequest((previous) => ({ page, nonce: previous.nonce + 1 }));
  }, []);

  const onMessage = useCallback((message: FrameMessage) => {
    if (message.type === 'picked') {
      const handlers = pickHandlers.current;
      handlers.onPicked?.({
        nodeId: message.nodeId,
        label:
          nodeLabelOf({ document: handlers.document, nodeId: message.nodeId }) ?? message.label,
      });
      return;
    }
    if (message.type === 'pickEnded') {
      pickHandlers.current.onPickEnded?.();
      return;
    }
    if (pickingRef.current) {
      postToFrame({ frame: frameRef.current, command: { type: 'pick', isOn: true } });
    }
    if (variantRef.current !== null) {
      postToFrame({
        frame: frameRef.current,
        command: { type: 'variant', variantId: variantRef.current },
      });
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
    () =>
      document.screens.map((entry) => ({
        id: entry.id,
        title: entry.title,
        states: stateOptions({ screen: entry }),
      })),
    [document.screens],
  );
  const screenStates = screen === null ? [] : stateOptions({ screen });
  const chooseVariant = (next: string) => {
    setVariant(next);
    postToFrame({ frame: frameRef.current, command: { type: 'variant', variantId: next } });
  };
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
        {leading ?? null}
        <StudioDetailTabs
          ariaLabel="Wireframe view"
          options={VIEW_OPTIONS}
          value={view}
          onChange={setView}
        />
        {view === 'screen' && screen !== null && screenStates.length > 1 ? (
          <SegmentedTabs
            ariaLabel="State"
            options={screenStates.map((state) => ({ value: state.id, label: state.label }))}
            value={shown.state ?? DEFAULT_STATE}
            onChange={(state) =>
              open({ screenId: screen.id, state: state === DEFAULT_STATE ? null : state })
            }
            size="sm"
          />
        ) : null}
        {view === 'screen' && variant !== null && variants.length > 1 ? (
          <SegmentedTabs
            ariaLabel="Variant"
            options={variants.map((entry) => ({ value: entry.id, label: entry.label }))}
            value={variant}
            onChange={chooseVariant}
            size="sm"
          />
        ) : null}
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
      {banner ?? null}
      {stage.status === 'failed' ? (
        <span role="alert" className="text-meta text-danger">
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
          <div className="flex min-w-0 flex-col gap-3">
            {stage.status === 'ready' ? (
              <div key={revisionKey} className="min-w-0 motion-safe:animate-fade-in">
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
              </div>
            ) : (
              <div
                data-testid="wireframe-stage-pending"
                className="min-h-40 rounded-md bg-subtle"
              />
            )}
            {renderComposer === undefined ? null : renderComposer(screen)}
          </div>
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
