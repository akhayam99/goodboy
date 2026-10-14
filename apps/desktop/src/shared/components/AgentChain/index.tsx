import type { Agent, SessionId } from '@goodboy/types';
import { AgentChainStep } from './AgentChainStep';

type Props = {
  readonly sessionId: SessionId;
  readonly steps: ReadonlyArray<{
    readonly name: string;
    readonly agent: Agent | null;
    readonly isRunning: boolean;
    readonly detail?: string;
    readonly tone?: 'success' | 'warning' | 'danger' | 'neutral';
  }>;
  readonly linkLabel?: string;
};

export const AgentChain = ({ sessionId, steps, linkLabel }: Props) => (
  <ul aria-label="Agent chain" className="flex flex-col gap-2">
    {steps.map((step) => (
      <AgentChainStep
        key={step.agent === null ? step.name : step.agent.id}
        sessionId={sessionId}
        name={step.name}
        agent={step.agent}
        isRunning={step.isRunning}
        {...(step.detail !== undefined && { detail: step.detail })}
        {...(step.tone !== undefined && { tone: step.tone })}
        {...(linkLabel !== undefined && { linkLabel })}
      />
    ))}
  </ul>
);
