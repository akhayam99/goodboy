import { X } from '@goodboy/ui/icons';
import { Button, IconButton, Input, Tooltip, cn, tintClasses } from '@goodboy/ui';
import type { CommandField } from '../../hooks/useCommandField';
import { hostOf } from '../../hostOf';
import type { BrowserPaneModel } from '../../types';
import { BrowserFavicon } from './BrowserFavicon';

const DANGER_BORDER = tintClasses('danger').border;

const ACTIVE_SLOT = 'flex min-w-40 shrink grow basis-auto';

type Props = {
  readonly model: BrowserPaneModel;
  readonly field: CommandField;
  readonly onClose?: () => void;
};

export const BrowserAddressPill = ({ model, field, onClose }: Props) => {
  const title = model.shown === null ? '' : model.titleOf({ tab: model.shown.tab });
  const host = hostOf({ url: model.address });
  const hasError = model.error !== null;
  const isHostShown = title !== host;
  const name = isHostShown ? `${title}, ${host}` : title;

  if (!field.isFieldShown) {
    return (
      <div className={cn(ACTIVE_SLOT, 'items-center gap-0.5')}>
        <Tooltip
          content="Edit address"
          shortcut="browser.address"
          side="top"
          anchorClassName="flex min-w-0 flex-1"
        >
          <Button
            ref={field.pillRef}
            variant="secondary"
            data-browser-tab="active"
            aria-current="page"
            aria-label={`Edit address, ${name}`}
            onClick={field.edit}
            className={cn(
              'w-full min-w-0 justify-start px-2 text-left font-normal',
              hasError && DANGER_BORDER,
            )}
          >
            <BrowserFavicon url={model.address} isPin={model.shown?.isPin === true} />
            <span className="min-w-0 truncate text-row text-foreground">{title}</span>
            {isHostShown ? (
              <span className="min-w-0 truncate text-meta text-muted-foreground">{host}</span>
            ) : null}
          </Button>
        </Tooltip>
        {onClose === undefined ? null : (
          <IconButton
            icon={X}
            label={`Close ${title}`}
            size="xs"
            variant="ghost"
            tooltipSide="top"
            onClick={onClose}
          />
        )}
      </div>
    );
  }

  return (
    <form
      className={ACTIVE_SLOT}
      onSubmit={(event) => {
        event.preventDefault();
        void field.submit();
      }}
    >
      <Input
        ref={field.fieldRef}
        role="combobox"
        aria-label="Address or search"
        aria-expanded={field.isOpen}
        aria-controls={field.isOpen ? field.listId : undefined}
        aria-activedescendant={field.activeId ?? undefined}
        aria-autocomplete="list"
        placeholder="Address, open tab, or visited page"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        value={field.value}
        onChange={(event) => field.type({ text: event.target.value })}
        onKeyDown={(event) => field.keysRef.current?.(event)}
        onFocus={(event) => {
          event.currentTarget.select();
          field.setFocused({ isFocused: true });
        }}
        onBlur={() => field.setFocused({ isFocused: false })}
        className={cn('text-code', hasError && DANGER_BORDER)}
      />
    </form>
  );
};
