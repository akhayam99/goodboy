import { cn, Eyebrow, ICON_SIZE, ROW_INTERACTIVE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly suggestions: ReadonlyArray<string>;
  readonly onAsk: (question: string) => void;
};

const AskIcon = CONCEPT_ICONS.ask;

export const AskSuggestions = ({ suggestions, onAsk }: Props) => (
  <section aria-label="Try asking" className="flex flex-col gap-1">
    <Eyebrow label="Try asking" />
    {suggestions.map((suggestion) => (
      <button
        key={suggestion}
        type="button"
        onClick={() => onAsk(suggestion)}
        className={cn(
          'flex min-h-8 items-center gap-2 rounded-md bg-background px-3 py-1 text-left text-prose text-foreground ring-1 ring-inset ring-border-soft',
          ROW_INTERACTIVE,
        )}
      >
        <AskIcon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
        <span className="min-w-0 truncate">{suggestion}</span>
      </button>
    ))}
  </section>
);
