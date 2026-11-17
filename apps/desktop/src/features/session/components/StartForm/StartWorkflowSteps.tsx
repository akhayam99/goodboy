import type { Step } from '@goodboy/types';
import { AGENT_KIND_META, classifyStep } from '../../agent-kind';
import { START_KIND_COPY } from '../../startKind/startKindCopy';

type Props = {
  readonly steps: ReadonlyArray<Step>;
};

export const StartWorkflowSteps = ({ steps }: Props) => (
  <ol aria-label={START_KIND_COPY.presetSteps} className="flex flex-col gap-1">
    {steps.map((step, index) => (
      <li key={step.id} className="flex min-w-0 items-baseline gap-2 text-meta">
        <span className="w-4 shrink-0 text-faint-foreground tabular-nums">{index + 1}</span>
        <span className="shrink-0 text-muted-foreground">
          {AGENT_KIND_META[classifyStep({ step })].noun}
        </span>
        <span className="min-w-0 truncate text-foreground">{step.name}</span>
      </li>
    ))}
  </ol>
);
