import { Eyebrow, cn } from '@goodboy/ui';
import type { SessionSuggestion } from '../../../../../../suggestions';
import type { SuggestionActionResolver } from '../../../../../../suggestions/useSuggestionActions';
import { TIMELINE_GUTTER } from '../timelineLayout';
import { TimelineSuggestionItem } from './TimelineSuggestionItem';

type Props = {
  readonly suggestions: ReadonlyArray<SessionSuggestion>;
  readonly railWidth: number;
  readonly actionsFor: SuggestionActionResolver;
};

export const TimelineSuggestionStrip = ({ suggestions, railWidth, actionsFor }: Props) => {
  if (suggestions.length === 0) {
    return null;
  }
  return (
    <div className="flex min-w-0">
      <span className={cn('shrink-0', TIMELINE_GUTTER)} />
      <span className="shrink-0" style={{ width: railWidth }} />
      <section
        aria-label="Suggested next"
        className="flex min-w-0 flex-1 items-start gap-3 rounded-md bg-subtle px-2 py-1.5"
      >
        <Eyebrow label="Suggested next" className="shrink-0 leading-6 @max-md/activity:hidden" />
        <ul className="flex min-w-0 flex-1 flex-col">
          {suggestions.map((suggestion) => (
            <TimelineSuggestionItem
              key={suggestion.id}
              suggestion={suggestion}
              actions={actionsFor({ suggestion })}
            />
          ))}
        </ul>
      </section>
    </div>
  );
};
