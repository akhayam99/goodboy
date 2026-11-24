import { Chip } from '@goodboy/ui';

type Props = {
  readonly suggestions: ReadonlyArray<string>;
  readonly isDisabled: boolean;
  readonly onAsk: (question: string) => void;
};

export const AskStarters = ({ suggestions, isDisabled, onAsk }: Props) => {
  if (suggestions.length === 0) {
    return null;
  }
  return (
    <div role="group" aria-label="Try asking" className="flex flex-wrap gap-1">
      {suggestions.map((suggestion) => (
        <Chip
          key={suggestion}
          as="button"
          tone="neutral"
          kind="reference"
          label={suggestion}
          disabled={isDisabled}
          onClick={() => onAsk(suggestion)}
        />
      ))}
    </div>
  );
};
