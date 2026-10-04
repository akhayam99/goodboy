import { useMemo, useRef } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore, useExecutedAgentRoutings } from '../../../../../../../store';
import { useRoutingScope } from '../../../../../../../shared/hooks/useRoutingScope';
import { useSessionRoleModels } from '../../../../../../../shared/hooks/useSessionRoleModels';
import { agentRowRouting } from '../../../../../timeline/agentRowRouting';
import {
  agentGroupsOf,
  routingFactsOf,
  sameRoutingFacts,
  type TimelineRoutingFacts,
} from '../timelineRouting';
import type { TimelineRows } from '../useTimelineRows';

type Params = {
  readonly session: Session;
  readonly rows: TimelineRows;
};

export const useTimelineRoutingFacts = ({ session, rows }: Params): TimelineRoutingFacts => {
  const sessionId = session.id;
  const providerOverrides = useAppStore((s) => s.agentProviderOverride);
  const modelOverrides = useAppStore((s) => s.agentModelOverride);
  const effortOverrides = useAppStore((s) => s.agentEffortOverride);
  const roleModels = useSessionRoleModels({ sessionId });
  const scope = useRoutingScope({ sessionId });
  const sessionProvider = session.providerPreference?.defaultProvider ?? null;
  const sessionEffort = session.effort ?? null;
  const { entries, stepById } = rows;
  const grouped = useMemo(() => agentGroupsOf({ entries }), [entries]);
  const agents = useMemo(() => grouped.map(({ agent }) => agent.agent), [grouped]);
  const executed = useExecutedAgentRoutings({ sessionId, agents });

  const previous = useRef<TimelineRoutingFacts | null>(null);

  return useMemo(() => {
    const routes = grouped.map(({ agent: entry, groupId }) => {
      const { agent } = entry;
      const routing = agentRowRouting({
        executed: executed.get(agent.id) ?? null,
        step: agent.stepId == null ? null : (stepById.get(agent.stepId) ?? null),
        kind: entry.agentKind,
        roleModels,
        providerOverride: providerOverrides[agent.id] ?? agent.providerOverride ?? null,
        modelOverride: modelOverrides[agent.id] ?? agent.modelOverride ?? null,
        effortOverride: effortOverrides[agent.id] ?? agent.effort ?? null,
        sessionProvider,
        sessionEffort,
        scope,
      });
      return { agentId: agent.id, groupId, model: routing.model };
    });
    const facts = routingFactsOf({ routes });
    const kept =
      previous.current !== null && sameRoutingFacts({ first: previous.current, second: facts })
        ? previous.current
        : facts;
    previous.current = kept;
    return kept;
  }, [
    grouped,
    executed,
    stepById,
    roleModels,
    providerOverrides,
    modelOverrides,
    effortOverrides,
    sessionProvider,
    sessionEffort,
    scope,
  ]);
};
