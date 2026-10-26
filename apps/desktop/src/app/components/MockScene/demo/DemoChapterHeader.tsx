import { Eyebrow } from '@goodboy/ui';

type Props = {
  readonly title: string;
  readonly isOptional: boolean;
  readonly instruction: string | undefined;
};

export const DemoChapterHeader = ({ title, isOptional, instruction }: Props) => (
  <header className="flex min-w-0 flex-col gap-1">
    <div className="flex flex-wrap items-baseline gap-x-3">
      <h1 className="text-display text-foreground">{title}</h1>
      {isOptional ? <Eyebrow label="Optional" muted /> : null}
    </div>
    {instruction === undefined ? null : (
      <p data-testid="demo-instruction" className="text-ui text-muted-foreground">
        {instruction}
      </p>
    )}
  </header>
);
