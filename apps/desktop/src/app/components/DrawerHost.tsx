import type { ReactNode } from 'react';
import { useAppStore } from '../../store';
import { selectDrawerPanel } from '../../store/slices/drawer/selectDrawerPanel';
import { ContextDrawer } from '../../features/session/components/ContextDrawer';
import { ExploreFileDrawer } from '../../features/explore/components/ExploreFileDrawer';
import { ExplorePane } from '../../features/explore/components/ExplorePane';
import { SessionScriptsDrawer } from '../../features/scripts/components/SessionScriptsDrawer';
import { ArtifactShellDrawer } from '../../features/artifacts/components/ArtifactShell/ArtifactShellDrawer';
import { ArtifactDocumentDrawer } from '../../features/artifacts/components/ArtifactDocumentDrawer';
import { ScriptRunDrawer } from '../../features/scripts/components/ScriptRunDrawer';
import { QuestionDrawer } from '../../features/session/components/QuestionDrawer';
import { WritePanel } from '../../features/artifacts/components/WritePanel';
import { NewDrawer } from '../../features/session/components/NewDrawer';
import { FixCommentsDrawer } from '../../features/resolve/components/FixCommentsDrawer';
import { ReviewCommentDrawerHost } from '../../features/resolve/components/ReviewCommentDrawer/ReviewCommentDrawerHost';
import { AutoChildPane } from './AutoChildPane';
import { FixRunTranscriptDrawer } from './FixRunTranscriptDrawer';
import { RunStepDrawer } from '../../features/session/components/RunStepDrawer';
import { SpawnedPanel } from './SpawnedPanel';
import { LogDrawer } from '../../features/session/central/log/LogDrawer';
import { ExploreAddFolder } from './ExploreAddFolder';
import { ExploreFileChanges } from './ExploreFileChanges';
import { ArtifactReadingDrawer } from './ArtifactReadingDrawer';
import { readingArtifactOf } from './ArtifactReadingDrawer/readingArtifact';
import { drawerKey } from '../../store/slices/drawer/drawerKey';
import type { DrawerRequest } from '../../store/slices/drawer/state';
import { PanelBoundary } from './PanelBoundary';
import { renderRegisteredDrawer } from './renderRegisteredDrawer';

const NO_HIGHLIGHT: ReadonlyArray<number> = [];

type RenderParams = {
  readonly drawer: DrawerRequest;
  readonly isReading: boolean;
  readonly closeDrawer: () => void;
  readonly openDrawer: (request: DrawerRequest) => void;
};

const renderDrawer = ({ drawer, isReading, closeDrawer, openDrawer }: RenderParams): ReactNode => {
  switch (drawer.kind) {
    case 'context':
      return (
        <ContextDrawer
          key={drawer.sessionId}
          sessionId={drawer.sessionId}
          tab={drawer.payload.tab}
          view={drawer.payload.view}
          highlight={drawer.payload.highlight ?? NO_HIGHLIGHT}
          onClose={closeDrawer}
        />
      );
    case 'explore-file':
      return (
        <ExploreFileDrawer
          key={`${drawer.sessionId}:${drawer.payload.entry.relPath}`}
          sessionId={drawer.sessionId}
          sessionDir={drawer.payload.sessionDir}
          entry={drawer.payload.entry}
          line={drawer.payload.line}
          {...(drawer.payload.from === 'explore' && {
            back: {
              label: 'Back to files',
              onBack: () =>
                openDrawer({ kind: 'explore', sessionId: drawer.sessionId, payload: null }),
            },
          })}
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
        <ArtifactDocumentDrawer
          key={drawerKey(drawer)}
          sessionId={drawer.sessionId}
          artifactId={drawer.payload.artifactId}
          revision={drawer.payload.revision}
          onClose={closeDrawer}
        />
      );
    case 'scriptRun':
      return (
        <ScriptRunDrawer
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
    case 'explore':
      return (
        <ExplorePane
          key={drawer.sessionId}
          sessionId={drawer.sessionId}
          noFolderAction={<ExploreAddFolder sessionId={drawer.sessionId} />}
          onClose={closeDrawer}
        />
      );
    case 'scripts':
      return (
        <SessionScriptsDrawer
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
          onClose={closeDrawer}
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
    case 'auto-child':
      return (
        <AutoChildPane
          key={drawerKey(drawer)}
          sessionId={drawer.sessionId}
          agentId={drawer.payload.agentId}
          onClose={closeDrawer}
        />
      );
    case 'spawned':
      return (
        <SpawnedPanel key={drawer.sessionId} sessionId={drawer.sessionId} onClose={closeDrawer} />
      );
    case 'session-log':
      return (
        <LogDrawer
          key={drawerKey(drawer)}
          sessionId={drawer.sessionId}
          focusEntryId={drawer.payload.focusEntryId}
          onClose={closeDrawer}
        />
      );
    case 'run-step':
      return (
        <RunStepDrawer
          key={drawerKey(drawer)}
          sessionId={drawer.sessionId}
          runId={drawer.payload.runId}
          agentId={drawer.payload.agentId}
          onClose={closeDrawer}
        />
      );
    case 'fix-comments':
      return (
        <FixCommentsDrawer
          key={drawerKey(drawer)}
          sessionId={drawer.sessionId}
          focusThreadId={drawer.payload.focusThreadId ?? null}
          threadIds={drawer.payload.threadIds ?? null}
          fromThreadId={drawer.payload.fromThreadId ?? null}
          onClose={closeDrawer}
        />
      );
    case 'conversation':
      return <ReviewCommentDrawerHost />;
    case 'ask':
    case 'check-analysis':
    case 'file-diff':
    case 'history-versions':
    case 'plan-part':
    case 'terminal':
      return renderRegisteredDrawer({ drawer, closeDrawer, openDrawer });
    default: {
      const exhaustive: never = drawer;
      throw new Error(`unknown drawer kind: ${String(exhaustive)}`);
    }
  }
};

export const DrawerHost = () => {
  const drawer = useAppStore(selectDrawerPanel);
  const closeDrawer = useAppStore((s) => s.closeDrawer);
  const openDrawer = useAppStore((s) => s.openDrawer);
  const isReading = useAppStore((s) => {
    const open = selectDrawerPanel(s);
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
      {renderDrawer({ drawer, isReading, closeDrawer, openDrawer })}
    </PanelBoundary>
  );
};
