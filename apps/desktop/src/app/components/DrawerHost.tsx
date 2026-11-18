import type { ReactNode } from 'react';
import { DrawerBackChipContext } from '@goodboy/ui';
import { useAppStore } from '../../store';
import { selectSlotDrawer, type DrawerSlot } from '../../store/slices/drawer/selectSlotDrawer';
import { selectSlotBack } from '../../store/slices/drawer/selectSlotBack';
import { useSlotBackChip } from '../hooks/useSlotBackChip';
import { ExploreFileDrawer } from '../../features/explore/components/ExploreFileDrawer';
import { LazySessionScriptsDrawer } from '../../features/scripts/components/LazySessionScriptsDrawer';
import { ArtifactShellDrawer } from '../../features/artifacts/components/ArtifactShell/ArtifactShellDrawer';
import { LazyArtifactDocumentDrawer } from '../../features/artifacts/components/ArtifactDocumentDrawer/LazyArtifactDocumentDrawer';
import { LazyScriptRunDrawer } from '../../features/scripts/components/LazyScriptRunDrawer';
import { QuestionDrawer } from '../../features/session/components/QuestionDrawer';
import { WritePanel } from '../../features/artifacts/components/WritePanel';
import { NewDrawer } from '../../features/session/components/NewDrawer';
import { LazyFixCommentsDrawer } from '../../features/resolve/components/LazyFixCommentsDrawer';
import { ReviewCommentDrawerHost } from '../../features/resolve/components/ReviewCommentDrawer/ReviewCommentDrawerHost';
import { FixRunTranscriptDrawer } from './FixRunTranscriptDrawer';
import { ExploreFileChanges } from './ExploreFileChanges';
import { ArtifactReadingDrawer } from './ArtifactReadingDrawer';
import { readingArtifactOf } from './ArtifactReadingDrawer/readingArtifact';
import { drawerKey } from '../../store/slices/drawer/drawerKey';
import type { DrawerRequest } from '../../store/slices/drawer/state';
import { PanelBoundary } from './PanelBoundary';
import { renderRegisteredDrawer } from './renderRegisteredDrawer';

type RenderParams = {
  readonly drawer: DrawerRequest;
  readonly isReading: boolean;
  readonly closeDrawer: () => void;
  readonly closeQuestion: () => void;
  readonly openDrawer: (request: DrawerRequest) => void;
};

const renderDrawer = ({
  drawer,
  isReading,
  closeDrawer,
  closeQuestion,
  openDrawer,
}: RenderParams): ReactNode => {
  switch (drawer.kind) {
    case 'explore-file':
      return (
        <ExploreFileDrawer
          key={`${drawer.sessionId}:${drawer.payload.entry.relPath}`}
          sessionId={drawer.sessionId}
          sessionDir={drawer.payload.sessionDir}
          entry={drawer.payload.entry}
          line={drawer.payload.line}
          renderChanges={({ sessionDir, relPath, baseBranch }) => (
            <ExploreFileChanges sessionDir={sessionDir} relPath={relPath} baseBranch={baseBranch} />
          )}
          onClose={closeDrawer}
        />
      );
    case 'artifact':
      return (
        <ArtifactShellDrawer
          sessionId={drawer.sessionId}
          artifactId={drawer.payload.artifactId}
          tab={drawer.payload.tab}
          onClose={closeDrawer}
        />
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
    case 'scripts':
      return (
        <LazySessionScriptsDrawer
          key={drawer.sessionId}
          sessionId={drawer.sessionId}
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
      return (
        <FixRunTranscriptDrawer
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
    case 'plan-part':
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

export const DrawerHost = ({ slot = 'top' }: Props) => {
  const drawer = useAppStore((state) => selectSlotDrawer({ state, slot }));
  const isTop = useAppStore((state) => drawer !== null && state.drawer === drawer);
  const back = useAppStore((state) => (isTop ? selectSlotBack({ state }) : null));
  const backChip = useSlotBackChip({ back });
  const closeEntry = useAppStore((s) => s.closeDrawerEntry);
  const closeTopQuestion = useAppStore((s) => s.closeQuestion);
  const openDrawer = useAppStore((s) => s.openDrawer);
  const closeDrawer = () => {
    if (drawer !== null) {
      closeEntry({ entry: drawer });
    }
  };
  const closeQuestion = isTop ? closeTopQuestion : closeDrawer;
  const isReading = useAppStore((s) => {
    const open = selectSlotDrawer({ state: s, slot });
    return (
      open?.kind === 'artifact-document' &&
      readingArtifactOf({
        state: s,
        sessionId: open.sessionId,
        artifactId: open.payload.artifactId,
      }) !== null
    );
  });

  if (drawer === null) {
    return null;
  }
  return (
    <PanelBoundary key={drawerKey(drawer)} leaveLabel="Close drawer" onLeave={closeDrawer}>
      <DrawerBackChipContext.Provider value={backChip}>
        <div className="contents" data-browser-session={drawer.sessionId}>
          {renderDrawer({ drawer, isReading, closeDrawer, closeQuestion, openDrawer })}
        </div>
      </DrawerBackChipContext.Provider>
    </PanelBoundary>
  );
};
