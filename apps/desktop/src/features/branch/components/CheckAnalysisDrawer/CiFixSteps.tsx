import type { SessionId } from '@goodboy/types';
import { Button, StatusDot } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { agentPlace } from '../../../../store/slices/navigation/place';
import type { CiFixStep } from '../../checks/ciFixStepsOf';

type Props = {
  readonly sessionId: SessionId;
  readonly steps: ReadonlyArray<CiFixStep>;
};

export const CiFixSteps = ({ sessionId, steps }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  return (
    <ul aria-label="Agent chain" className="flex min-w-0 flex-col">
      {steps.map((step) => {
        const agent = step.agent;
        return (
          <li
            key={agent === null ? step.name : agent.id}
            className="flex min-h-8 min-w-0 items-center gap-3"
          >
            <StatusDot tone={step.tone} pulsing={step.isRunning} size="sm" />
            <span className="min-w-0 truncate text-row text-foreground">{step.name}</span>
            <span className="min-w-0 flex-1 truncate text-meta text-muted-foreground">
              {step.detail}
            </span>
            {agent === null ? null : (
              <Button
                variant="ghost"
                size="xs"
                aria-label={`Transcript of ${agent.name}`}
                onClick={() => navigate({ to: agentPlace({ sessionId, agentId: agent.id }) })}
              >
                Transcript
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
};
