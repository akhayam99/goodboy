import { useMemo } from 'react';
import type { SessionMountView } from '@goodboy/types';
import { EmptyState, PaneShell, SkeletonRows } from '@goodboy/ui';
import type { AgentId, MountId, Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { selectOpenDrawer } from '../../../../../store/slices/drawer/selectOpenDrawer';
import { useGroupBy } from '../../../../../store/slices/session-grouping/hooks/useGroupBy';
import { useMountRows } from '../../../../../shared/hooks/useMountRows';
import type { AgentKind } from '../../../agent-kind';
import { useCanOpenBranchWork } from '../../../hooks/useCanOpenBranchWork';
import { useQuestionsLens } from '../../../hooks/useQuestionsLens';
import { openBranchWorkTab } from '../../../openBranchWorkTab';
import { openQuestion } from '../../../openQuestion';
import { ContextLoadFailure } from '../../ContextDrawer/ContextLoadFailure';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { QuestionsGrid } from './QuestionsGrid';
import {
  questionBranchCountOf,
  questionBranchGroupsOf,
  questionGroupsOf,
  questionRowsOf,
} from './questionsLensModel';
import { NAMES } from '../../../../../shared/utils/names';

type QuestionsPaneProps = {
  readonly session: Session;
};

type OpenBranchParams = {
  readonly mountId: MountId;
};

const NO_MOUNTS: ReadonlyArray<SessionMountView> = [];

const NO_KIND_OVERRIDES: Readonly<Record<AgentId, AgentKind>> = {};

const TITLE = 'Questions';

export const QuestionsPane = ({ session }: QuestionsPaneProps) => {
  const sessionId = session.id as SessionId;
  const { model, agents, isLoaded, hasLoadError, reload, beginUndo } = useQuestionsLens({
    sessionId,
    load: 'on-mount',
  });
  const kindOverrides = useAppStore((s) => s.agentKindOverride ?? NO_KIND_OVERRIDES);
  const openedId = useAppStore((s) => {
    const drawer = selectOpenDrawer(s);
    return drawer?.kind === 'question' && drawer.sessionId === sessionId
      ? drawer.payload.questionId
      : null;
  });
  const groups = useMemo(() => questionGroupsOf({ model }), [model]);
  const rows = useMemo(() => questionRowsOf({ model }), [model]);
  const setGroupBy = useAppStore((s) => s.setGroupBy);
  const sessionMounts = useAppStore((s) => s.sessionMounts[sessionId] ?? NO_MOUNTS);
  const projects = useAppStore((s) => s.projects);
  const mountGroups = useMountRows({ sessionId });
  const canOpenBranch = useCanOpenBranchWork({ sessionId });
  const mounts = useMemo(
    () => mountGroups.flatMap((group) => [...group.rows, ...group.finishedRows]),
    [mountGroups],
  );
  const branchGroups = useMemo(
    () => questionBranchGroupsOf({ model, agents, sessionMounts, projects, mounts }),
    [model, agents, sessionMounts, projects, mounts],
  );
  const branchCount = useMemo(
    () => questionBranchCountOf({ groups: branchGroups }),
    [branchGroups],
  );
  const groupBy = useGroupBy({ sessionId, branchCount });
  const openBranch = ({ mountId }: OpenBranchParams) => {
    openBranchWorkTab({ sessionId, mountId });
  };

  if (!isLoaded && hasLoadError) {
    return (
      <PaneShell page="questions">
        <ContextLoadFailure title={TITLE} onRetry={reload} />
      </PaneShell>
    );
  }

  if (!isLoaded) {
    return (
      <PaneShell page="questions">
        <SkeletonRows label="Loading questions" />
      </PaneShell>
    );
  }

  if (rows.length === 0) {
    return (
      <PaneShell page="questions">
        <EmptyState
          size="page"
          icon={CONCEPT_ICONS.questions}
          title={NAMES.noQuestionsYet}
          description="Agents bring you the choices they can't make."
        />
      </PaneShell>
    );
  }

  return (
    <PaneShell page="questions">
      <QuestionsGrid
        sessionId={sessionId}
        groups={groups}
        branchGroups={branchGroups}
        mounts={mounts}
        groupBy={groupBy}
        branchCount={branchCount}
        agents={agents}
        kindOverrides={kindOverrides}
        selectedId={openedId}
        onDismissed={({ question }) => beginUndo(question)}
        onOpenBranch={openBranch}
        canOpenBranch={canOpenBranch}
        onGroupByChange={(next) => setGroupBy({ sessionId, groupBy: next.groupBy })}
        onOpen={({ questionId }) =>
          openQuestion({ state: useAppStore.getState(), sessionId, questionId })
        }
      />
    </PaneShell>
  );
};
