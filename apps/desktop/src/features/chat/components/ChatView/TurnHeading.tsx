type Props = {
  index: number;
  text: string;
};

type HeadingParams = {
  readonly text: string;
};

const headingOf = ({ text }: HeadingParams): string =>
  text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '') ?? 'Turn';

export const TurnHeading = ({ index, text }: Props) => (
  <li data-turn-heading={index}>
    <p className="truncate text-meta text-muted-foreground">{headingOf({ text })}</p>
  </li>
);
