import { useMemo } from 'react';
import { Eyebrow, formatError } from '@goodboy/ui';
import type { Agent, Session, SessionProjectMount } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useIsSessionCollectionLoaded } from '../../../../store';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import { buildCommentAgentArgs, type ResolveModelChoice } from '../../../chat/spawn-from-comment';
import { groupThreads } from '../../../github/comment-threads';
import { SuggestionRow } from '../../../suggestions/components/SuggestionRow';
import { useSessionSuggestions, type SessionSuggestion } from '../../../suggestions';
import { kindRouting } from '../../agent-kind';
import { useResolverIndex } from '../../hooks/useResolverIndex';
import { useResolverSpawner } from '../../hooks/useResolverSpawner';
import { resolverForComment } from '../../resolver-linkage';
import { OverviewRebaseAction } from './OverviewRebaseAction';
import { OverviewWorkflowAction } from './OverviewWorkflowAction';

type Props = {
  readonly session: Session;
  readonly agents: ReadonlyArray<Agent>;
  readonly onSelectQuestions: () => void;
};

const OVERVIEW_KINDS: ReadonlySet<SessionSuggestion['kind']> = new Set<SessionSuggestion['kind']>([
  'workflow-next-step',
  'resolve-threads',
  'rebase-project',
  'answer-questions',
]);

export const OverviewSuggestions = ({ session, agents, onSelectQuestions }: Props) => {
  const sessionId = session.id;
  const areAgentsLoaded = useIsSessionCollectionLoaded({ sessionId, collection: 'agents' });
  const suggestions = useSessionSuggestions({ session, agents });
  const github = useAppStore((state) => state.sessionGithub[sessionId] ?? null);
  const pendingResolutions = useAppStore(
    (state) => state.sessionPendingResolutions[sessionId] ?? EMPTY_ARRAY,
  );
  const mounts = useAppStore(
    (state) =>
      state.sessionProjectMounts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<SessionProjectMount>),
  );
  const activateNextResolver = useAppStore((state) => state.activateNextResolver);
  const emitNotification = useAppStore((state) => state.emitNotification);
  const roleModels = useSessionRoleModels({ sessionId });
  const resolverIndex = useResolverIndex(sessionId);
  const { spawnResolver } = useResolverSpawner({ sessionId });
  const unresolvedThreads = useMemo(() => {
    const pendingThreadIds = new Set(pendingResolutions.map((resolution) => resolution.threadId));
    return groupThreads(github?.detail?.comments ?? []).filter((thread) => {
      if (thread.head.source !== 'review' || thread.head.resolved !== false) {
        return false;
      }
      if (thread.head.threadId != null && pendingThreadIds.has(thread.head.threadId)) {
        return false;
      }
      const resolver = resolverForComment(resolverIndex, {
        threadId: thread.head.threadId,
        url: thread.head.url,
      });
      return resolver == null || resolver.status === 'failed';
    });
  }, [github, pendingResolutions, resolverIndex]);
  const pullRequest = github?.pr ?? null;
  const routing = kindRouting({ kind: 'resolver', roleModels });
  const choice: ResolveModelChoice = {
    provider: routing.provider,
    model: routing.model,
    effort: routing.effort,
  };
  const startResolving = () => {
    if (pullRequest == null || unresolvedThreads.length === 0) {
      return;
    }
    void (async () => {
      const isBatch = unresolvedThreads.length > 1;
      for (const thread of unresolvedThreads) {
        await spawnResolver({
          args: buildCommentAgentArgs(thread.head, pullRequest, choice, thread.replies),
          choice,
          deferKickoff: isBatch,
        });
      }
      if (isBatch) {
        await activateNextResolver(sessionId);
      }
    })().catch((error: unknown) => {
      void emitNotification('error', 'error', 'resolver failed to start', formatError(error), {
        sessionId,
      });
    });
  };

  const visible = suggestions.filter((suggestion) => OVERVIEW_KINDS.has(suggestion.kind));
  if (!areAgentsLoaded || visible.length === 0) {
    return null;
  }
  return (
    <section aria-label="Suggestions" className="flex flex-col gap-2">
      <Eyebrow label="Suggestions" className="px-0.5" />
      <div className="flex flex-col gap-1.5">
        {visible.map((suggestion) => {
          if (suggestion.kind === 'workflow-next-step') {
            const engineRun = suggestion.payload.runId;
            const runAgents = agents.filter((agent) => agent.workflowRunId === engineRun);
            return (
              <SuggestionRow
                key={suggestion.id}
                suggestion={suggestion}
                size="row"
                actionLabel="Continue"
                onAction={() => undefined}
                action={
                  <OverviewWorkflowAction
                    session={session}
                    runId={suggestion.payload.runId}
                    stepId={suggestion.payload.stepId}
                    runAgents={runAgents}
                  />
                }
              />
            );
          }
          if (suggestion.kind === 'resolve-threads') {
            return (
              <SuggestionRow
                key={suggestion.id}
                suggestion={suggestion}
                size="row"
                actionLabel="Resolve"
                onAction={startResolving}
              />
            );
          }
          if (suggestion.kind === 'rebase-project') {
            const mount =
              mounts.find((candidate) => candidate.projectId === suggestion.payload.projectId) ??
              null;
            return (
              <OverviewRebaseAction key={suggestion.id} suggestion={suggestion} mount={mount} />
            );
          }
          if (suggestion.kind === 'answer-questions') {
            return (
              <SuggestionRow
                key={suggestion.id}
                suggestion={suggestion}
                size="row"
                actionLabel="Answer"
                onAction={onSelectQuestions}
              />
            );
          }
          return null;
        })}
      </div>
    </section>
  );
};
