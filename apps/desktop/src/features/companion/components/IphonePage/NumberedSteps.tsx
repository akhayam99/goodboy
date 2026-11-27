type Props = {
  readonly steps: ReadonlyArray<string>;
  readonly className: string;
};

export const NumberedSteps = ({ steps, className }: Props) => (
  <ol className={`flex flex-col gap-2 ${className}`}>
    {steps.map((step, index) => (
      <li key={step} className="flex gap-2">
        <span className="w-3 shrink-0 text-faint-foreground tabular-nums">{index + 1}</span>
        {step}
      </li>
    ))}
  </ol>
);
