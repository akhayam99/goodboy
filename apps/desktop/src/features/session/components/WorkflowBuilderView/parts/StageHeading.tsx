type Props = {
  readonly title: string;
  readonly subtitle: string;
};

export const StageHeading = ({ title, subtitle }: Props) => (
  <header className="flex flex-col gap-1">
    <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
    <p className="text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
  </header>
);
