import { StatusDot, type Tone } from '@goodboy/ui';

type Props = {
  readonly tone: Tone;
  readonly word: string;
  readonly autoWord?: string;
};

export const LiveStateWord = ({ tone, word, autoWord }: Props) => (
  <>
    <StatusDot tone={tone} size="sm" />
    <span
      data-auto-word={autoWord}
      className="min-w-0 truncate whitespace-nowrap text-ui text-muted-foreground"
    >
      {word}
    </span>
  </>
);
