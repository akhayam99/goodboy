import type { LucideIcon } from 'lucide-react';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { sessionTitle } from '../../../session/sessionTitle';
import type { PaletteScope } from '../../types';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

export type ScopeInfo = {
  readonly title: string;
  readonly noun: string;
  readonly icon: LucideIcon;
  readonly key: string;
};

export const useScopeInfo = (scope: PaletteScope | null): ScopeInfo | null => {
  const title = useAppStore((s) => {
    if (scope === null) {
      return null;
    }
    if (scope.kind === 'workspace') {
      return s.workspaces.find((workspace) => workspace.id === scope.workspaceId)?.name ?? null;
    }
    if (scope.kind === 'commit') {
      return scope.facts.subject === '' ? scope.facts.shortSha : scope.facts.subject;
    }
    if (scope.kind === 'agent') {
      return (
        (s.sessionPhaseRuns[scope.sessionId] ?? EMPTY_ARRAY).find(
          (agent) => agent.id === scope.agentId,
        )?.name ?? null
      );
    }
    if (scope.kind === 'workflowRun') {
      const run =
        sessionById(s.sessions, scope.sessionId)?.workflowRuns.find(
          (candidate) => candidate.id === scope.runId,
        ) ?? null;
      const workflowName =
        (s.sessionWorkflows[scope.sessionId] ?? EMPTY_ARRAY).find(
          (candidate) => candidate.id === run?.workflowId,
        )?.name ?? null;
      return run === null ? null : (run.title ?? workflowName ?? 'Run');
    }
    if (scope.kind === 'pullRequest') {
      return scope.prNumber === null ? 'Pull request' : `Pull request #${scope.prNumber}`;
    }
    const session =
      sessionById(s.sessions, scope.sessionId) ??
      Object.values(s.archivedSessions)
        .flat()
        .find((candidate) => candidate.id === scope.sessionId) ??
      null;
    return session === null ? null : sessionTitle({ session });
  });
  if (scope === null || title === null) {
    return null;
  }
  switch (scope.kind) {
    case 'workspace':
      return {
        title,
        noun: 'workspace',
        icon: CONCEPT_ICONS.workspace,
        key: `workspace:${scope.workspaceId}`,
      };
    case 'session':
      return {
        title,
        noun: 'session',
        icon: CONCEPT_ICONS.sessions,
        key: `session:${scope.sessionId}`,
      };
    case 'agent':
      return { title, noun: 'agent', icon: CONCEPT_ICONS.agents, key: `agent:${scope.agentId}` };
    case 'workflowRun':
      return { title, noun: 'run', icon: CONCEPT_ICONS.workflows, key: `run:${scope.runId}` };
    case 'pullRequest':
      return {
        title,
        noun: 'pull request',
        icon: CONCEPT_ICONS.pr,
        key: `pr:${scope.sessionId}`,
      };
    case 'commit':
      return {
        title,
        noun: 'commit',
        icon: CONCEPT_ICONS.commits,
        key: `commit:${scope.facts.sha}`,
      };
    default: {
      const exhaustive: never = scope;
      return exhaustive;
    }
  }
};
