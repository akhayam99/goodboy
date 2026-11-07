import { useCallback, useEffect, useMemo } from 'react';
import type { Agent, MountId, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useIsSessionCollectionLoaded,
  useSessionOpenQuestions,
  useSessionPlans,
  agentPlace,
} from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { branchPlace } from '../../../../store/slices/navigation/place';
import { useGroupBy } from '../../../../store/slices/session-grouping/hooks/useGroupBy';
import type { GroupBy } from '../../../../store/slices/session-grouping/state';
import { ArtifactList } from '../ArtifactList';
import type { ArtifactOpenParams } from '../ArtifactList/artifactBranchProps';
import { ArtifactShell } from '../ArtifactShell';
import type { ArtifactShellSubject } from '../ArtifactShell/artifactShellSubject';
import {
  countArtifactRows,
  filterArtifactRows,
  groupArtifactRowsByBranch,
} from '../../artifactListRows';
import { artifactBranchRowKeyOf } from '../../artifactBranchRowKeys';
import { useArtifactBranchItems } from '../../hooks/useArtifactBranchItems';
import { useArtifactRows } from '../../hooks/useArtifactRows';
import { planAsArtifact, planFromArtifact } from '../../../plans/planAsArtifact';
import { PaneShell, useEscapeLayer } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { GoneObject } from '../../../../shared/components/GoneObject';
import { isTextEntryTarget } from '../../../../shared/keyboard/isTypingTarget';
import { openArtifactPage } from '../../openArtifactPage';
import { useRowReturn } from '../../../../shared/hooks/useRowReturn';
import { useArtifactGenerations } from './useArtifactGenerations';

type Props = {
  readonly sessionId: SessionId;
};

type OpenBranchParams = {
  readonly mountId: MountId;
};

type GroupByParams = {
  readonly groupBy: GroupBy;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

export const ArtifactStudio = ({ sessionId }: Props) => {
  const artifacts = useAppStore((s) => s.sessionArtifacts[sessionId] ?? EMPTY_ARRAY);
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  const plans = useSessionPlans(sessionId);
  const openQuestions = useSessionOpenQuestions(sessionId);
  const loadSessionArtifacts = useAppStore((s) => s.loadSessionArtifacts);
  const focusedArtifactId = useAppStore((s) => s.focusedArtifactId[sessionId] ?? null);
  const navigate = useAppStore((s) => s.navigate);
  const up = useAppStore((s) => s.up);
  const isShown = useAppStore(
    (s) => s.currentSessionId === sessionId && s.activeLens[sessionId] === 'plans',
  );
  const hasArtifacts = useAppStore((s) => s.sessionArtifacts[sessionId] !== undefined);
  const hasPlans = useIsSessionCollectionLoaded({ sessionId, collection: 'plans' });
  const filter = useAppStore((s) => s.artifactFilter[sessionId] ?? 'all');
  const setArtifactFilter = useAppStore((s) => s.setArtifactFilter);
  const awaitedAgentId = useAppStore((s) => s.awaitedArtifactAgentId[sessionId] ?? null);
  const awaitArtifactAgent = useAppStore((s) => s.awaitArtifactAgent);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[sessionId] ?? null);
  const isArtifactDrawerOpen = useAppStore((s) => {
    const kind = selectOpenDrawer(s)?.kind ?? null;
    return kind === 'artifact' || kind === 'plan-part';
  });
  const setFocusedRunAgent = useAppStore((s) => s.setFocusedRunAgent);
  const { generations, focusedRun } = useArtifactGenerations({
    sessionId,
    agents,
    artifacts,
    openQuestions,
  });

  useEffect(() => {
    void loadSessionArtifacts(sessionId);
  }, [sessionId, loadSessionArtifacts]);

  useEffect(() => {
    if (awaitedAgentId === null) {
      return;
    }
    const arrived = artifacts.find((artifact) => artifact.agentId === awaitedAgentId) ?? null;
    if (arrived === null) {
      return;
    }
    awaitArtifactAgent({ sessionId, agentId: null });
    if (focusedArtifactId === null && selectedAgentId === null) {
      openArtifactPage({ sessionId, artifactId: arrived.id, isArrival: true });
    }
  }, [
    artifacts,
    awaitedAgentId,
    awaitArtifactAgent,
    focusedArtifactId,
    selectedAgentId,
    sessionId,
  ]);

  const subject = useMemo((): ArtifactShellSubject | null => {
    if (focusedArtifactId !== null) {
      const plan = plans.find((candidate) => candidate.id === focusedArtifactId) ?? null;
      const stored = artifacts.find((candidate) => candidate.id === focusedArtifactId) ?? null;
      if (plan !== null) {
        return { kind: 'plan', plan, artifact: planAsArtifact({ plan, stored }) };
      }
      if (stored?.kind === 'plan') {
        return { kind: 'plan', plan: planFromArtifact({ artifact: stored }), artifact: stored };
      }
      if (stored?.kind === 'report') {
        return { kind: 'report', artifact: stored };
      }
      if (stored?.kind === 'wireframe') {
        return { kind: 'wireframe', artifact: stored };
      }
    }
    return focusedRun === null ? null : { kind: 'generation', generation: focusedRun };
  }, [focusedArtifactId, plans, artifacts, focusedRun]);

  const rows = useArtifactRows({ sessionId, generations });
  const counts = useMemo(() => countArtifactRows({ rows }), [rows]);
  const visibleRows = useMemo(() => filterArtifactRows({ rows, filter }), [rows, filter]);

  const setGroupBy = useAppStore((s) => s.setGroupBy);
  const branchItems = useArtifactBranchItems({ sessionId, rows, plans, artifacts, agents });
  const groupBy = useGroupBy({ sessionId, branchCount: branchItems.branchCount });
  const branchView = useMemo(() => {
    const visibleIds = new Set(visibleRows.map((row) => row.id));
    return groupArtifactRowsByBranch({
      items: branchItems.items.filter((item) => visibleIds.has(item.row.id)),
      mounts: branchItems.mounts,
    });
  }, [visibleRows, branchItems.items, branchItems.mounts]);
  const rowIds = useMemo(
    () =>
      groupBy === 'branch'
        ? [
            ...branchView.groups.flatMap((group) =>
              group.items.map((item) =>
                artifactBranchRowKeyOf({ groupKey: group.key, rowId: item.row.id }),
              ),
            ),
            ...branchView.deleted.map((row) => row.id),
          ]
        : rows.map((row) => row.id),
    [groupBy, branchView, rows],
  );
  const rowReturn = useRowReturn({
    listKey: 'artifacts',
    rowIds,
    rowAttribute: 'data-artifact-row',
  });
  const { remember } = rowReturn;
  const changeGroupBy = useCallback(
    ({ groupBy: next }: GroupByParams) => setGroupBy({ sessionId, groupBy: next }),
    [setGroupBy, sessionId],
  );
  const openBranch = useCallback(
    ({ mountId }: OpenBranchParams) => {
      const mount = branchItems.mounts.find((candidate) => candidate.mountId === mountId);
      navigate({ to: branchPlace({ sessionId, mountPath: mount?.worktreePath ?? null }) });
    },
    [branchItems.mounts, navigate, sessionId],
  );
  const openRow = useCallback(
    ({ row, rowKey }: ArtifactOpenParams) => {
      if (row.target.kind === 'artifact') {
        remember({ rowId: rowKey });
        openArtifactPage({ sessionId, artifactId: row.target.artifactId });
        return;
      }
      const { generation } = row.target;
      if (generation.state === 'unproduced') {
        navigate({ to: agentPlace({ sessionId, agentId: generation.agentId }) });
        return;
      }
      setFocusedRunAgent({ sessionId, agentId: generation.agentId });
    },
    [navigate, remember, sessionId, setFocusedRunAgent],
  );

  useEscapeLayer(
    () => {
      if (isTextEntryTarget(document.activeElement)) {
        return;
      }
      setFocusedRunAgent({ sessionId, agentId: null });
    },
    isShown && selectedAgentId === null && subject?.kind === 'generation' && !isArtifactDrawerOpen,
  );

  if (subject === null && focusedArtifactId !== null && hasArtifacts && hasPlans) {
    return (
      <PaneShell page="artifacts" title="Artifact">
        <GoneObject noun="artifact" icon={CONCEPT_ICONS.plans} onBack={up} />
      </PaneShell>
    );
  }

  if (subject !== null) {
    const key = subject.kind === 'generation' ? subject.generation.agentId : subject.artifact.id;
    return <ArtifactShell key={key} sessionId={sessionId} subject={subject} agents={agents} />;
  }

  return (
    <ArtifactList
      sessionId={sessionId}
      returnRowId={rowReturn.returnRowId}
      rows={visibleRows}
      counts={counts}
      filter={filter}
      onFilterChange={(next) => setArtifactFilter({ sessionId, filter: next })}
      onOpen={openRow}
      branch={{
        view: branchView,
        mounts: branchItems.mounts,
        groupBy,
        branchCount: branchItems.branchCount,
        onGroupByChange: changeGroupBy,
        onOpenBranch: openBranch,
      }}
      onImported={(artifactId) => openArtifactPage({ sessionId, artifactId })}
    />
  );
};
