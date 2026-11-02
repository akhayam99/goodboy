import { ScrollFade } from './ScrollFade';

type Props = {
  readonly command: string;
};

export const CommandPreview = ({ command }: Props) => {
  return (
    <ScrollFade orientation="horizontal" fadeFrom="subtle" className="rounded-md bg-subtle">
      <div className="px-3 py-1 font-mono text-chip text-muted-foreground">
        <span aria-hidden className="text-faint-foreground">
          ${' '}
        </span>
        <span className="text-foreground">{command}</span>
      </div>
    </ScrollFade>
  );
};
