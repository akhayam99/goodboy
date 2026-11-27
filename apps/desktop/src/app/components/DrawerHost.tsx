import { Suspense, useContext, type ReactNode } from 'react';
import { DockCellContext, DrawerFrame, SkeletonRows } from '@goodboy/ui';
import { useAppStore } from '../../store';
import { selectSlotDrawer, type DrawerSlot } from '../../store/slices/drawer/selectSlotDrawer';
import { selectGridTool } from '../../store/slices/drawer/selectGridTool';
import { LazyExploreFileDrawer } from '../../features/explore/components/LazyExploreFileDrawer';
import { LazyArtifactDocumentDrawer } from '../../features/artifacts/components/ArtifactDocumentDrawer/LazyArtifactDocumentDrawer';
import { LazyScriptRunDrawer } from '../../features/scripts/components/LazyScriptRunDrawer';
import { QuestionDrawer } from '../../features/session/components/QuestionDrawer';
import { WritePanel } from '../../features/artifacts/components/WritePanel';
import { NewDrawer } from '../../features/session/components/NewDrawer';
import { LazyFixCommentsDrawer } from '../../features/resolve/components/LazyFixCommentsDrawer';
import { ReviewCommentDrawerHost } from '../../features/resolve/components/ReviewCommentDrawer/ReviewCommentDrawerHost';
import { LazyFixRunTranscriptDrawer } from './FixRunTranscriptDrawer/LazyFixRunTranscriptDrawer';
import { LazyExploreFileChanges } from './LazyExploreFileChanges';
import { ArtifactReadingDrawer } from './ArtifactReadingDrawer';
import { readingArtifactOf } from './ArtifactReadingDrawer/readingArtifact';
import { drawerKey } from '../../store/slices/drawer/drawerKey';
import type { DrawerRequest } from '../../store/slices/drawer/state';
import { shownDeskStackOf } from '../../store/slices/drawer/shownDeskStackOf';
import { DeskAgentPanel } from './DeskAgentPanel';
import { DeskDetailStack } from './DeskDetailStack';
import { PanelBoundary } from './PanelBoundary';
import { renderRegisteredDrawer } from './renderRegisteredDrawer';
import { lazyNamed } from '../../shared/lib/lazyNamed';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';

const ArtifactShellDrawer = lazyNamed({
  load: () => import('../../features/artifacts/components/ArtifactShell/ArtifactShellDrawer'),
  pick: ({ ArtifactShellDrawer }) => ArtifactShellDrawer,
});

type RenderParams = {
  readonly drawer: DrawerRequest;
  readonly isReading: boolean;
  readonly isDesk: boolean;
  readonly closeDrawer: () => void;
  readonly closeQuestion: () => void;
  readonly openDrawer: (request: DrawerRequest) => void;
};

const renderDrawer = ({
  drawer,
  isReading,
  isDesk,
  closeDrawer,
  closeQuestion,
  openDrawer,
}: RenderParams): ReactNode => {
  switch (drawer.kind) {
    case 'explore-file':
      return (
        <LazyExploreFileDrawer
          key={`${drawer.sessionId}:${drawer.payload.entry.relPath}`}
          sessionId={drawer.sessionId}
          sessionDir={drawer.payload.sessionDir}
          entry={drawer.payload.entry}
          line={drawer.payload.line}
          renderChanges={({ sessionDir, relPath, baseBranch }) => (
            <LazyExploreFileChanges
              sessionDir={sessionDir}
              relPath={relPath}
              baseBranch={baseBranch}
            />
          )}
          onClose={closeDrawer}
        />
      );
    case 'artifact':
      return (
        <Suspense
          fallback={
            <DrawerFrame title="Artifact" icon={CONCEPT_ICONS.plans} onClose={closeDrawer}>
              <SkeletonRows label="Opening the artifact" />
            </DrawerFrame>
          }
        >
          <ArtifactShellDrawer
            sessionId={drawer.sessionId}
            artifactId={drawer.payload.artifactId}
            tab={drawer.payload.tab}
            onClose={closeDrawer}
          />
        </Suspense>
      );
    case 'artifact-document':
      return isReading ? (
        <ArtifactReadingDrawer
          key={drawerKey(drawer)}
          sessionId={drawer.sessionId}
          artifactId={drawer.payload.artifactId}
          onClose={closeDrawer}
        />
      ) : (
        <LazyArtifactDocumentDrawer
          key={drawerKey(drawer)}
          sessionId={drawer.sessionId}
          artifactId={drawer.payload.artifactId}
          revision={drawer.payload.revision}
          onClose={closeDrawer}
        />
      );
    case 'scriptRun':
      return (
        <LazyScriptRunDrawer
          key={drawerKey(drawer)}
          sessionId={drawer.sessionId}
          scriptKey={drawer.payload.scriptKey}
          mountId={drawer.payload.mountId}
          {...(drawer.payload.from === 'scripts' && {
            back: {
              label: 'Back to scripts',
              onBack: () =>
                openDrawer({ kind: 'scripts', sessionId: drawer.sessionId, payload: null }),
            },
          })}
          onClose={closeDrawer}
        />
      );
    case 'question':
      return (
        <QuestionDrawer
          key={drawerKey(drawer)}
          sessionId={drawer.sessionId}
          questionId={drawer.payload.questionId}
          from={drawer.payload.from ?? null}
          onClose={closeQuestion}
        />
      );
    case 'new':
      return (
        <NewDrawer
          key={drawer.sessionId}
          sessionId={drawer.sessionId}
          payload={drawer.payload}
          writePanel={WritePanel}
          onClose={closeDrawer}
        />
      );
    case 'transcript':
      return isDesk ? (
        <DeskAgentPanel
          key={drawerKey(drawer)}
          sessionId={drawer.sessionId}
          agentId={drawer.payload.agentId}
          focus={drawer.payload}
          onClose={closeDrawer}
        />
      ) : (
        <LazyFixRunTranscriptDrawer
          key={drawerKey(drawer)}
          sessionId={drawer.sessionId}
          agentId={drawer.payload.agentId}
          onClose={closeDrawer}
        />
      );
    case 'fix-comments':
      return (
        <LazyFixCommentsDrawer
          key={drawerKey(drawer)}
          sessionId={drawer.sessionId}
          mountId={drawer.payload.mountId}
          focusThreadId={drawer.payload.focusThreadId ?? null}
          threadIds={drawer.payload.threadIds ?? null}
          fromThreadId={drawer.payload.fromThreadId ?? null}
          onClose={closeDrawer}
        />
      );
    case 'conversation':
      return <ReviewCommentDrawerHost />;
    case 'ask':
    case 'browser':
    case 'check-analysis':
    case 'file-diff':
    case 'history-versions':
    case 'identifier-peek':
    case 'lead-details':
    case 'monitoring':
    case 'plan-part':
    case 'pull-request':
    case 'scripts':
    case 'terminal':
      return renderRegisteredDrawer({ drawer, closeDrawer, openDrawer });
    default: {
      const exhaustive: never = drawer;
      throw new Error(`unknown drawer kind: ${String(exhaustive)}`);
    }
  }
};

type Props = {
  readonly slot?: DrawerSlot;
};

type HostParams = {
  readonly state: Parameters<typeof selectGridTool>[0]['state'];
  readonly slot: DrawerSlot;
  readonly tool: string | null;
};

const hostedDrawerOf = ({ state, slot, tool }: HostParams): DrawerRequest | null =>
  tool === null ? selectSlotDrawer({ state, slot }) : selectGridTool({ state, kind: tool });

export const DrawerHost = ({ slot = 'top' }: Props) => {
  const tool = useContext(DockCellContext);
  const drawer = useAppStore((state) => hostedDrawerOf({ state, slot, tool }));
  const isTop = useAppStore((state) => drawer !== null && state.drawer === drawer);
  const closeEntry = useAppStore((s) => s.closeDrawerEntry);
  const closeTopQuestion = useAppStore((s) => s.closeQuestion);
  const openDrawer = useAppStore((s) => s.openDrawer);
  const closeDrawer = () => {
    if (drawer !== null) {
      closeEntry({ entry: drawer });
    }
  };
  const closeQuestion = isTop ? closeTopQuestion : closeDrawer;
  const isDesk = useAppStore(
    (s) =>
      drawer !== null && drawer.sessionId !== null && s.sessionFace[drawer.sessionId] === 'desk',
  );
  const isDeskStack = useAppStore(
    (s) => slot === 'detail' && tool === null && shownDeskStackOf({ state: s }) !== null,
  );
  const isReading = useAppStore((s) => {
    const open = hostedDrawerOf({ state: s, slot, tool });
    return (
      open?.kind === 'artifact-document' &&
      readingArtifactOf({
        state: s,
        sessionId: open.sessionId,
        artifactId: open.payload.artifactId,
      }) !== null
    );
  });

  if (isDeskStack) {
    return <DeskDetailStack />;
  }
  if (drawer === null) {
    return null;
  }
  return (
    <PanelBoundary key={drawerKey(drawer)} leaveLabel="Close drawer" onLeave={closeDrawer}>
      <div className="contents" data-browser-session={drawer.sessionId}>
        {renderDrawer({ drawer, isReading, isDesk, closeDrawer, closeQuestion, openDrawer })}
      </div>
    </PanelBoundary>
  );
};
