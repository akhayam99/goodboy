import type { Agent, Workflow } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import { agentKindPalette, classifyAgent } from '../../agent-kind';
import { stepHeadingOf } from './stepHeadingOf';

type Props = {
  readonly agent: Agent;
  readonly stepAgent: Agent | null;
  readonly workflow: Workflow;
};

export const RunStepHeading = ({ agent, stepAgent, workflow }: Props) => {
  const kindOverride = useAppStore((state) => state.agentKindOverride[agent.id] ?? null);
  const kind = classifyAgent({ agent, override: kindOverride });
  const role = agentKindPalette({ kind }).label;
  return (
    <span data-run-step-heading="" className="flex min-w-32 items-center gap-2">
      <AgentKindChip kind={kind} density="glyph" isDecorative />
      <span className="min-w-0 truncate">
        {stepHeadingOf({ agent, stepAgent, workflow, role })}
      </span>
    </span>
  );
};
