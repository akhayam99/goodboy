import { ChevronLeft } from 'lucide-react';
import type { Agent, Session } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/names';
import { agentKindPalette, classifyAgent } from '../../../features/session/agent-kind';
import { leaveRunLevel } from '../../../features/workflows/leaveRunLevel';
import type { PresetRunFocus } from '../../../features/workflows/presetRunFocusOf';
import { runPlace } from '../../../features/workflows/runPlace';
import { RailButton } from './RailButton';

type Props = {
  readonly session: Session;
  readonly focus: PresetRunFocus;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

export const RailRunLevel = ({ session, focus }: Props) => {
  const sessionId = session.id;
  const navigate = useAppStore((state) => state.navigate);
  const kindOverride = useAppStore((state) => state.agentKindOverride);
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  const steps = agents
    .filter((agent) => agent.workflowRunId === focus.runId && agent.parentAgentId == null)
    .sort((left, right) => left.ordinal - right.ordinal);
  const open = (agentId: Agent['id'] | null) =>
    navigate({ to: runPlace({ sessionId, runId: focus.runId, agentId }) });

  return (
    <div data-rail-level="run" className="flex flex-col items-center gap-1">
      <RailButton
        id="level-back"
        icon={ChevronLeft}
        label={`Back to ${NAMES.runs}`}
        shortcut="nav.back"
        isCurrent={false}
        isPage
        onSelect={() => leaveRunLevel({ sessionId })}
      />
      <RailButton
        id="run-overview"
        icon={CONCEPT_ICONS.timeline}
        label={NAMES.overview}
        isCurrent={focus.agentId === null}
        isPage
        onSelect={() => open(null)}
      />
      {steps.map((agent, index) => {
        const palette = agentKindPalette({
          kind: classifyAgent({ agent, override: kindOverride[agent.id] ?? null }),
        });
        return (
          <RailButton
            key={agent.id}
            id={`run-step-${agent.id}`}
            icon={palette.icon}
            label={`Step ${index + 1}, ${palette.label}`}
            isCurrent={focus.agentId === agent.id}
            isPage
            onSelect={() => open(agent.id)}
          />
        );
      })}
    </div>
  );
};
