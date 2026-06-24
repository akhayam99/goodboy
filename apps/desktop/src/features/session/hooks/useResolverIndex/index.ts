import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { resolveAgentKind } from '../../agent-kind';
import {
  buildResolverIndex,
  resolverStatus,
  type ResolverIndex,
  type ResolverStatus,
} from '../../resolver-linkage';

export const useResolverIndex = (sessionId: SessionId): ResolverIndex => {
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const messages = useAppStore((s) => s.messages[sessionId] ?? EMPTY_ARRAY);
  const agentKindOverride = useAppStore(
    useShallow((s) => {
      const out: Record<string, ReturnType<typeof resolveAgentKind>> = {};
      const runs = s.sessionPhaseRuns[sessionId];
      if (!runs) {
        return out;
      }
      for (const run of runs) {
        const kind = s.agentKindOverride[run.id];
        if (kind) {
          out[run.id] = kind;
        }
      }
      return out;
    }),
  );
  const resolvedThreadIds = useAppStore(
    useShallow(
      (s) =>
        new Set(
          (s.sessionGithub[sessionId]?.detail?.comments ?? [])
            .filter((c) => c.resolved === true && c.threadId != null)
            .map((c) => c.threadId as string),
        ),
    ),
  );
  const pendingThreadIds = useAppStore(
    useShallow(
      (s) => new Set((s.sessionPendingResolutions[sessionId] ?? []).map((r) => r.threadId)),
    ),
  );
  const resolverState = useAppStore(
    useShallow((s) => {
      const out: Record<string, 'awaiting' | 'committed' | 'wontfix'> = {};
      const runs = s.sessionPhaseRuns[sessionId];
      if (!runs) {
        return out;
      }
      for (const run of runs) {
        const st = s.resolverState[run.id];
        if (st) {
          out[run.id] = st;
        }
      }
      return out;
    }),
  );

  const firstUserTextByAgentId = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of messages) {
      if (m.role !== 'user') {
        continue;
      }
      if (map.has(m.agentId)) {
        continue;
      }
      map.set(m.agentId, m.content);
    }
    return map;
  }, [messages]);

  const resolverAgents = useMemo(
    () =>
      phaseRuns.filter(
        (r) =>
          r.parentAgentId == null &&
          r.stepId == null &&
          resolveAgentKind(
            r.name,
            firstUserTextByAgentId.get(r.id) ?? null,
            agentKindOverride[r.id] ?? null,
          ) === 'resolver',
      ),
    [phaseRuns, firstUserTextByAgentId, agentKindOverride],
  );

  return useMemo(() => {
    const statusOf = (agent: Agent): ResolverStatus =>
      resolverStatus(agent, resolvedThreadIds, pendingThreadIds, resolverState[agent.id]);
    return buildResolverIndex(resolverAgents, { resolvedThreadIds, pendingThreadIds, statusOf });
  }, [resolverAgents, resolvedThreadIds, pendingThreadIds, resolverState]);
};
