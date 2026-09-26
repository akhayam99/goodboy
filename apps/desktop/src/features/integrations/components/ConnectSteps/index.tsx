import { ConnectStepsStep, type ConnectStepDef } from './Step';

type Props = {
  readonly steps: ReadonlyArray<ConnectStepDef>;
  readonly ariaLabel: string;
};

export const ConnectSteps = ({ steps, ariaLabel }: Props) => (
  <ol aria-label={ariaLabel} className="flex min-w-0 flex-col">
    {steps.map((step, index) => (
      <ConnectStepsStep
        key={step.id}
        step={step}
        ordinal={index + 1}
        isLast={index === steps.length - 1}
      />
    ))}
  </ol>
);

export type { ConnectStepDef, StepStatus } from './Step';
