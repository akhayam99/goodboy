import { useAppStore } from '../../store';
import { selectDrawerPanel } from '../../store/slices/drawer/selectDrawerPanel';
import { ContextDrawer } from '../../features/session/components/ContextDrawer';
import { ExploreFileDrawer } from '../../features/explore/components/ExploreFileDrawer';
import { ArtifactShellDrawer } from '../../features/artifacts/components/ArtifactShell/ArtifactShellDrawer';
import { ArtifactDocumentDrawer } from '../../features/artifacts/components/ArtifactDocumentDrawer';
import { PlanPartDrawer } from '../../features/plans/components/PlanParts/PlanPartDrawer';
import { ScriptRunDrawer } from '../../features/scripts/components/ScriptRunDrawer';
import { FileDiffDrawer } from '../../features/diff/components/FileDiffDrawer';
import { AskDrawer } from '../../features/session/ask/components/AskDrawer';
import { AgentTranscriptDrawer } from '../../features/chat/components/AgentTranscriptDrawer';
import { ReviewNotesDrawer } from '../../features/resolve/notes/components/ReviewNotesDrawer';
import { FixRunLead } from '../../features/resolve/components/FixRunSummary/FixRunLead';
import { ArtifactReadingDrawer } from './ArtifactReadingDrawer';
import { readingArtifactOf } from './ArtifactReadingDrawer/readingArtifact';
import { drawerKey } from '../../store/slices/drawer/drawerKey';

const NO_HIGHLIGHT: ReadonlyArray<number> = [];

export const DrawerHost = () => {
  const drawer = useAppStore(selectDrawerPanel);
  const closeDrawer = useAppStore((s) => s.closeDrawer);
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
          sessionDir={drawer.payload.sessionDir}
          entry={drawer.payload.entry}
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
    case 'plan-part':
      return (
        <PlanPartDrawer
          sessionId={drawer.sessionId}
          planId={drawer.payload.planId}
          index={drawer.payload.index}
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
          onClose={closeDrawer}
        />
      );
    case 'ask':
      return <AskDrawer sessionId={drawer.sessionId} onClose={closeDrawer} />;
    case 'transcript':
      return (
        <AgentTranscriptDrawer
          key={drawerKey(drawer)}
          sessionId={drawer.sessionId}
          agentId={drawer.payload.agentId}
          lead={<FixRunLead sessionId={drawer.sessionId} agentId={drawer.payload.agentId} />}
          onClose={closeDrawer}
        />
      );
    case 'review-notes':
      return (
        <ReviewNotesDrawer
          key={drawerKey(drawer)}
          sessionId={drawer.sessionId}
          mountPath={drawer.payload.mountPath}
          focusPath={drawer.payload.focusPath ?? null}
          focusThreadId={drawer.payload.focusThreadId ?? null}
          onClose={closeDrawer}
        />
      );
    case 'file-diff':
      return (
        <FileDiffDrawer
          key={drawerKey(drawer)}
          sessionId={drawer.sessionId}
          source={drawer.payload.source}
          path={drawer.payload.path}
          onClose={closeDrawer}
        />
      );
    default: {
      const exhaustive: never = drawer;
      throw new Error(`unknown drawer kind: ${String(exhaustive)}`);
    }
  }
};
