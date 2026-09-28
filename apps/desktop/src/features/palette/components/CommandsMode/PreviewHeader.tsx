type Props = {
  readonly title: string;
  readonly subtitle?: string;
};

export const PreviewHeader = ({ title, subtitle }: Props) => (
  <div className="flex flex-col gap-1">
    <h2 className="line-clamp-3 text-heading text-foreground">{title}</h2>
    {subtitle !== undefined && subtitle !== '' && (
      <p className="truncate text-label text-muted-foreground">{subtitle}</p>
    )}
  </div>
);
