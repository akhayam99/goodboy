import { useEffect, useRef, useState } from 'react';
import { Button, Input, Tooltip, cn, tintClasses, useEscapeLayer } from '@goodboy/ui';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import { hostOf } from '../../hostOf';
import type { BrowserPaneModel } from '../../types';
import { BrowserFavicon } from './BrowserFavicon';

const DANGER_BORDER = tintClasses('danger').border;

type Props = {
  readonly model: BrowserPaneModel;
  readonly isAddressShortcutOn: boolean;
};

export const BrowserAddressPill = ({ model, isAddressShortcutOn }: Props) => {
  const [draft, setDraft] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const isEmpty = model.shown === null;
  const isFieldShown = isEmpty || isEditing;
  const value = draft ?? model.address;
  const shownId = model.shown?.tab.id ?? null;
  const title = model.shown === null ? '' : model.titleOf({ tab: model.shown.tab });
  const host = hostOf({ url: model.address });
  const hasError = model.error !== null;

  useShortcut(
    'browser.address',
    () => {
      if (isFieldShown) {
        fieldRef.current?.focus({ preventScroll: true });
        return;
      }
      setIsEditing(true);
    },
    isAddressShortcutOn,
  );

  useEffect(() => {
    setDraft(null);
    setIsEditing(false);
  }, [shownId]);

  useEffect(() => {
    if (!isFieldShown) {
      return;
    }
    if (isEmpty) {
      setDraft(null);
    }
    fieldRef.current?.focus({ preventScroll: true });
  }, [isFieldShown, isEmpty, model.isDrafting]);

  const leave = (): void => {
    setDraft(null);
    setIsEditing(false);
  };

  useEscapeLayer(leave, isEditing && !isEmpty);

  const submitAddress = async (): Promise<void> => {
    const isDone = await model.submit({ text: value });
    if (!isDone) {
      return;
    }
    leave();
    fieldRef.current?.blur();
  };

  if (!isFieldShown) {
    return (
      <Tooltip
        content="Edit address"
        shortcut="browser.address"
        side="top"
        anchorClassName="flex min-w-0 flex-1"
      >
        <Button
          variant="secondary"
          aria-label={`Edit address, ${title}`}
          onClick={() => setIsEditing(true)}
          className={cn(
            'w-full min-w-0 justify-start px-2 text-left font-normal',
            hasError && DANGER_BORDER,
          )}
        >
          <BrowserFavicon url={model.address} isPin={model.shown?.isPin === true} />
          <span className="min-w-0 truncate text-row text-foreground">{title}</span>
          {title === host ? null : (
            <span className="shrink-0 truncate text-meta text-muted-foreground">{host}</span>
          )}
        </Button>
      </Tooltip>
    );
  }

  return (
    <form
      className="flex min-w-0 flex-1 items-center"
      onSubmit={(event) => {
        event.preventDefault();
        void submitAddress();
      }}
    >
      <Input
        ref={fieldRef}
        aria-label="Address"
        placeholder="Type an address, like localhost:5173"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        value={value}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={() => {
          if (!isEmpty) {
            leave();
          }
        }}
        className={cn('text-code', hasError && DANGER_BORDER)}
      />
    </form>
  );
};
