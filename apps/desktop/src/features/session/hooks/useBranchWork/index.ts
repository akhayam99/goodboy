import { useMemo } from 'react';
import type { Agent, SessionMountView } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { useMountRows } from '../../../../shared/hooks/useMountRows';
import { branchWorkArtifactsRegistration } from '../../../artifacts/branchWorkArtifactsRegistration';
import type { BranchWork, BranchWorkParams } from '../../../branch/branchWorkTab';
import { branchGroupKeyOfMount, branchGroupsOf, type BranchGroup } from '../../branchGroupsOf';
import { branchWorkCountsOf } from '../../branchWorkCountsOf';
import {
  questionBranchGroupsOf,
  type QuestionBranchGroup,
} from '../../components/SessionWorkspace/parts/questionsLensModel';
import { useQuestionsLens } from '../useQuestionsLens';
import { useSessionRuns } from '../useSessionRuns';

type ArtifactWork = ReturnType<typeof branchWorkArtifactsRegistration.useWork>;

export type BranchWorkView = Readonly<{
  groupKey: string | null;
  mountPath: string | null;
  mounts: ReadonlyArray<MountRowView>;
  runs: BranchGroup | null;
  questions: QuestionBranchGroup | null;
  questionAgents: ReadonlyArray<Agent>;
  isQuestionsLoaded: boolean;
  hasQuestionsError: boolean;
  reloadQuestions: () => void;
  artifacts: ArtifactWork;
}>;

const NO_MOUNTS: ReadonlyArray<SessionMountView> = [];

export const useBranchWork = ({
  session,
  mountId,
  mountPath,
}: BranchWorkParams): BranchWork<BranchWorkView> => {
  const sessionId = session.id;
  const runs = useSessionRuns({ session });
  const mountGroups = useMountRows({ sessionId });
  const mounts = useMemo(
    () => mountGroups.flatMap((group) => [...group.rows, ...group.finishedRows]),
    [mountGroups],
  );
  const questionsLens = useQuestionsLens({ sessionId, load: 'when-missing' });
  const { model, agents } = questionsLens;
  const sessionMounts = useAppStore((state) => state.sessionMounts[sessionId] ?? NO_MOUNTS);
  const projects = useAppStore((state) => state.projects);
  const artifacts = branchWorkArtifactsRegistration.useWork({ sessionId, mountId });
  const groupKey = mountId === null ? null : branchGroupKeyOfMount({ mountId, mounts });

  const runGroup = useMemo(
    () =>
      groupKey === null
        ? null
        : (branchGroupsOf({ runs, mounts }).find((group) => group.key === groupKey) ?? null),
    [groupKey, mounts, runs],
  );
  const questionGroup = useMemo(
    () =>
      groupKey === null
        ? null
        : (questionBranchGroupsOf({ model, agents, sessionMounts, projects, mounts }).find(
            (group) => group.key === groupKey,
          ) ?? null),
    [agents, groupKey, model, mounts, projects, sessionMounts],
  );

  const isQuestionsSettled = questionsLens.isLoaded || questionsLens.hasLoadError;
  const isArtifactsSettled = artifacts.isLoaded || artifacts.error !== null;
  const isLoaded = isQuestionsSettled && isArtifactsSettled;
  const { count: artifactCount, needsYouAgentIds } = artifacts;
  const counts = useMemo(
    () =>
      isLoaded
        ? branchWorkCountsOf({
            runs: runGroup,
            questions: questionGroup,
            artifacts: { count: artifactCount, needsYouAgentIds },
          })
        : null,
    [artifactCount, isLoaded, needsYouAgentIds, questionGroup, runGroup],
  );

  return {
    counts,
    isLoaded,
    view: {
      groupKey,
      mountPath,
      mounts,
      runs: runGroup,
      questions: questionGroup,
      questionAgents: agents,
      isQuestionsLoaded: questionsLens.isLoaded,
      hasQuestionsError: questionsLens.hasLoadError,
      reloadQuestions: questionsLens.reload,
      artifacts,
    },
  };
};
