import { useAppStore } from '../../../store';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import { SlotHistoryDrawer } from '../../../features/session/components/SessionWorkspace/parts/SlotHistoryDrawer';
import { ExploreFileDrawer } from '../../../features/explore/components/ExploreFileDrawer';
import { ArtifactShellDrawer } from '../../../features/artifacts/components/ArtifactShell/ArtifactShellDrawer';
import { PlanPartDrawer } from '../../../features/plans/components/PlanParts/PlanPartDrawer';
import { ScriptRunDrawer } from '../../../features/scripts/components/ScriptRunDrawer';
import { DiffNotesDrawer } from '../../../features/diff/components/DiffNotesDrawer';
import { FileDiffDrawer } from '../../../features/diff/components/FileDiffDrawer';
import { ReviewDraftsDrawer } from '../../../features/review/components/ReviewDraftsDrawer';
import { ConversationDrawerSlot } from '../../../features/resolve/components/ConversationDrawerSlot';
import { drawerKey } from '../../../store/slices/drawer/drawerKey';

export const DrawerHost = () => {
  const drawer = useAppStore(selectOpenDrawer);
  const closeDrawer = useAppStore((s) => s.closeDrawer);

  if (drawer === null) {
    return null;
  }
  switch (drawer.kind) {
    case 'slot-history':
      return (
        <SlotHistoryDrawer
          sessionId={drawer.sessionId}
          slotKey={drawer.payload.slotKey}
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
    case 'diff-notes':
      return <DiffNotesDrawer sessionId={drawer.sessionId} onClose={closeDrawer} />;
    case 'review-drafts':
      return <ReviewDraftsDrawer sessionId={drawer.sessionId} onClose={closeDrawer} />;
    case 'conversation':
      return <ConversationDrawerSlot />;
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
