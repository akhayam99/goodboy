import { Button, Input, Tooltip, cn, tintClasses } from '@goodboy/ui';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import type { CommandField } from '../../hooks/useCommandField';
import { hostOf } from '../../hostOf';
import type { BrowserPaneModel } from '../../types';
import { BrowserFavicon } from './BrowserFavicon';

const DANGER_BORDER = tintClasses('danger').border;

type Props = {
  readonly model: BrowserPaneModel;
  readonly field: CommandField;
  readonly isAddressShortcutOn: boolean;
};

export const BrowserAddressPill = ({ model, field, isAddressShortcutOn }: Props) => {
  const title = model.shown === null ? '' : model.titleOf({ tab: model.shown.tab });
  const host = hostOf({ url: model.address });
  const hasError = model.error !== null;
  const isHostShown = title !== host;
  const name = isHostShown ? `${title}, ${host}` : title;

  useShortcut('browser.address', field.edit, isAddressShortcutOn);

  if (!field.isFieldShown) {
    return (
      <Tooltip
        content="Edit address"
        shortcut="browser.address"
        side="top"
        anchorClassName="flex min-w-0 flex-1"
      >
        <Button
          ref={field.pillRef}
          variant="secondary"
          aria-label={`Edit address, ${name}`}
          onClick={field.edit}
          className={cn(
            'w-full min-w-0 justify-start border-border px-2 text-left font-normal',
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
    );
  }

  return (
    <form
      className="flex min-w-0 flex-1 items-center"
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
