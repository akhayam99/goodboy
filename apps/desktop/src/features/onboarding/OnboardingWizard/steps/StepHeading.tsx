type Props = {
  readonly title: string;
  readonly line?: string;
};

export const StepHeading = ({ title, line }: Props) => (
  <div className="flex flex-col gap-2">
    <h2 tabIndex={-1} data-step-title className="text-display text-foreground outline-none">
      {title}
    </h2>
    {line !== undefined && <p className="text-read text-muted-foreground">{line}</p>}
  </div>
);
