import { CheckAnalysisDrawer } from '../../features/branch/components/CheckAnalysisDrawer';
import { useAppStore } from '../../store';
import { selectDrawerPanel } from '../../store/slices/drawer/selectDrawerPanel';
import { ContextDrawer } from '../../features/session/components/ContextDrawer';
import { ExploreFileDrawer } from '../../features/explore/components/ExploreFileDrawer';
import { ArtifactShellDrawer } from '../../features/artifacts/components/ArtifactShell/ArtifactShellDrawer';
import { ArtifactDocumentDrawer } from '../../features/artifacts/components/ArtifactDocumentDrawer';
import { PlanPartDrawer } from '../../features/plans/components/PlanParts/PlanPartDrawer';
import { ScriptRunDrawer } from '../../features/scripts/components/ScriptRunDrawer';
import { TerminalDrawer } from '../../features/terminal/components/TerminalDrawer';
import { FileDiffDrawer } from '../../features/diff/components/FileDiffDrawer';
import { FileWholeDrawer } from '../../features/diff/components/FileWholeDrawer';
import { AskDrawer } from '../../features/session/ask/components/AskDrawer';
import { WritePanel } from '../../features/artifacts/components/WritePanel';
import { NewDrawer } from '../../features/session/components/NewDrawer';
import { HistoryVersionsDrawer } from '../../features/history/components/HistoryVersionsDrawer';
import { FixCommentsDrawer } from '../../features/resolve/components/FixCommentsDrawer';
import { FixRunTranscriptDrawer } from './FixRunTranscriptDrawer';
import { RunStepDrawer } from '../../features/session/components/RunStepDrawer';
import { ExploreFileChanges } from './ExploreFileChanges';
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
    case 'check-analysis':
      return (
        <CheckAnalysisDrawer
          sessionId={drawer.payload.sessionId}
          mountId={drawer.payload.mountId}
          checkUrl={drawer.payload.checkUrl}
          onClose={closeDrawer}
        />
      );
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
          onClose={closeDrawer}
        />
      );
    case 'history-versions':
      return (
        <HistoryVersionsDrawer
          key={drawerKey(drawer)}
          sessionId={drawer.sessionId}
          mountId={drawer.payload.mountId}
          worktreePath={drawer.payload.worktreePath}
          onClose={closeDrawer}
        />
      );
    case 'file-diff':
      if (drawer.payload.whole !== undefined && drawer.payload.source.kind === 'worktree') {
        return (
          <FileWholeDrawer
            key={drawerKey(drawer)}
            worktreePath={drawer.payload.source.worktreePath}
            whole={drawer.payload.whole}
            onClose={closeDrawer}
          />
        );
      }
      return (
        <FileDiffDrawer
          key={drawerKey(drawer)}
          sessionId={drawer.sessionId}
          source={drawer.payload.source}
          path={drawer.payload.path}
          onClose={closeDrawer}
        />
      );
    case 'terminal':
      return (
        <TerminalDrawer
          key={drawerKey(drawer)}
          sessionId={drawer.sessionId}
          terminalId={drawer.payload.terminalId}
          onClose={closeDrawer}
        />
      );
    default: {
      const exhaustive: never = drawer;
      throw new Error(`unknown drawer kind: ${String(exhaustive)}`);
    }
  }
};
