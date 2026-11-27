import { useId } from 'react';
import { CodeXml, SquareDashedMousePointer } from '@goodboy/ui/icons';
import { CountBadge, IconButton, cn } from '@goodboy/ui';
import type { BrowserTools } from '../../hooks/useBrowserTools';
import type { ElementPick } from '../../hooks/useElementPick';

type Props = {
  readonly tools?: BrowserTools;
  readonly pick?: ElementPick;
  readonly hasTab: boolean;
};

type CountParams = {
  readonly count: number;
};

const PRESSED = 'aria-pressed:border-border aria-pressed:bg-segment-active aria-pressed:shadow-sm';

const PRESSED_TEXT = 'aria-pressed:text-foreground';

const errorsTextOf = ({ count }: CountParams): string =>
  `${count} ${count === 1 ? 'error' : 'errors'}`;

export const BrowserToolsCapsule = ({ tools, pick, hasTab }: Props) => {
  const countId = useId();
  if (tools === undefined && pick === undefined) {
    return null;
  }
  const count = tools?.errorCount ?? 0;
  const hasErrors = count > 0;
  const errorsText = errorsTextOf({ count });
  return (
    <div
      role="group"
      aria-label="Page tools"
      data-browser-capsule=""
      className="flex shrink-0 items-center gap-0.5 rounded-md bg-fill p-0.5"
    >
      {pick === undefined ? null : (
        <IconButton
          icon={SquareDashedMousePointer}
          label="Select an element"
          size="xs"
          aria-pressed={pick.isPicking}
          shortcut="browser.pick"
          tooltipSide="top"
          disabled={!pick.canPick && !pick.isPicking}
          onClick={pick.toggle}
          className={cn(PRESSED, PRESSED_TEXT)}
        />
      )}
      {tools === undefined ? null : (
        <span className="relative inline-flex">
          <IconButton
            ref={tools.buttonRef}
            icon={CodeXml}
            label="Console"
            size="xs"
            tooltip={hasErrors ? `Console, ${errorsText}` : 'Console'}
            aria-pressed={tools.isOpen}
            aria-describedby={hasErrors ? countId : undefined}
            shortcut="browser.console"
            tooltipSide="top"
            tone={hasErrors ? 'danger' : 'neutral'}
            disabled={!hasTab}
            onClick={() => tools.toggle({ isByKey: false })}
            onFocus={tools.focusWatch.onFocus}
            onBlur={tools.focusWatch.onBlur}
            className={cn(PRESSED, !hasErrors && PRESSED_TEXT)}
          />
          <CountBadge count={count} tone="danger" placement="corner" isAnnounced={false} />
          {hasErrors ? (
            <span id={countId} className="sr-only">
              {errorsText}
            </span>
          ) : null}
        </span>
      )}
    </div>
  );
};
