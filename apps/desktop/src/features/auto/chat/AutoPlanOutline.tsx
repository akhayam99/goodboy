import type { AutoPlanOutline as Outline } from './autoPlanOutlineOf';

type Props = {
  readonly outline: Outline;
};

type CountParams = {
  readonly count: number;
  readonly noun: string;
};

const countWord = ({ count, noun }: CountParams): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

export const AutoPlanOutline = ({ outline }: Props) => (
  <div className="flex min-w-0 flex-col gap-1">
    <ol className="flex min-w-0 flex-col gap-0.5">
      {outline.steps.map((step, index) => (
        <li key={step} className="flex min-w-0 gap-2">
          <span className="shrink-0 tabular-nums text-faint-foreground">{index + 1}.</span>
          <span className="min-w-0 truncate">{step}</span>
        </li>
      ))}
    </ol>
    <p className="text-faint-foreground">
      {[
        countWord({ count: outline.stepCount, noun: 'step' }),
        countWord({ count: outline.fileCount, noun: 'file' }),
        countWord({ count: outline.riskCount, noun: 'risk' }),
      ].join(' · ')}
    </p>
  </div>
);
