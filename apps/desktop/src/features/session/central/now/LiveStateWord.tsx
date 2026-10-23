import { StatusDot, cn, tintClasses, type Tone } from '@goodboy/ui';

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
      className={cn(
        'min-w-0 truncate text-ui',
        tone === 'neutral' ? 'text-muted-foreground' : tintClasses(tone).text,
      )}
    >
      {word}
    </span>
  </>
);
