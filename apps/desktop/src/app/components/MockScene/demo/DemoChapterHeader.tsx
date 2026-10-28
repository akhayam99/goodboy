import { DemoEmphasis } from './DemoEmphasis';

type Props = {
  readonly title: string;
  readonly instruction: string | undefined;
};

export const DemoChapterHeader = ({ title, instruction }: Props) => (
  <header className="flex min-w-0 flex-col gap-1">
    <h1 className="text-display text-foreground">{title}</h1>
    {instruction === undefined ? null : (
      <p data-testid="demo-instruction" className="text-ui text-muted-foreground">
        <DemoEmphasis text={instruction} />
      </p>
    )}
  </header>
);
