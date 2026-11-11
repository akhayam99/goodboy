import type { KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Button, ICON_SIZE, IconButton, cn } from '@goodboy/ui';
import type { FindInPage, FindOutcome } from '../../hooks/useFindInPage';
import { findOutcomeText } from '../../findOutcomeText';

type Props = {
  readonly find: FindInPage;
};

type KeyParams = {
  readonly event: KeyboardEvent<HTMLInputElement>;
};

type ToneParams = {
  readonly outcome: FindOutcome;
};

const isDangerOutcome = ({ outcome }: ToneParams): boolean =>
  outcome === 'missing' || outcome === 'failed';

export const BrowserFindBar = ({ find }: Props) => {
  const isEmpty = find.text === '';
  const handleKeyDown = ({ event }: KeyParams) => {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    find.walk({ isBackwards: event.shiftKey });
  };

  return (
    <div className="shrink-0 px-2">
      <div
        role="search"
        aria-label="Find in page"
        className="flex h-8 items-center gap-2 rounded-md bg-subtle px-3"
      >
        <Search size={ICON_SIZE.control} aria-hidden className="shrink-0 text-faint-foreground" />
        <input
          ref={find.inputRef}
          type="text"
          value={find.text}
          placeholder="Find in page"
          aria-label="Find in page"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          maxLength={200}
          onChange={(event) => find.type({ text: event.target.value })}
          onKeyDown={(event) => handleKeyDown({ event })}
          className="min-w-0 flex-1 bg-transparent text-row text-foreground placeholder:text-faint-foreground focus-visible:outline-none"
        />
        <span
          role="status"
          className={cn(
            'shrink-0 whitespace-nowrap text-meta text-faint-foreground',
            isDangerOutcome({ outcome: find.outcome }) && 'text-danger',
          )}
        >
          {findOutcomeText({ outcome: find.outcome })}
        </span>
        <IconButton
          icon={ChevronUp}
          label="Previous match"
          variant="ghost"
          size="xs"
          disabled={isEmpty}
          onClick={() => find.walk({ isBackwards: true })}
        />
        <IconButton
          icon={ChevronDown}
          label="Next match"
          variant="ghost"
          size="xs"
          disabled={isEmpty}
          onClick={() => find.walk({ isBackwards: false })}
        />
        <Button variant="secondary" size="xs" onClick={find.close}>
          Done
        </Button>
      </div>
    </div>
  );
};
