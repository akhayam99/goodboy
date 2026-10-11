import type { Agent, SessionId } from '@goodboy/types';
import { AgentChainStep } from './AgentChainStep';

type Props = {
  readonly sessionId: SessionId;
  readonly steps: ReadonlyArray<{
    readonly name: string;
    readonly agent: Agent;
    readonly isRunning: boolean;
  }>;
};

export const AgentChain = ({ sessionId, steps }: Props) => (
  <ul aria-label="Agent chain" className="flex flex-col gap-2">
    {steps.map((step) => (
      <AgentChainStep
        key={step.agent.id}
        sessionId={sessionId}
        name={step.name}
        agent={step.agent}
        isRunning={step.isRunning}
      />
    ))}
  </ul>
);
