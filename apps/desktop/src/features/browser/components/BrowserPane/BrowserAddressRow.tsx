import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, PanelLeft, Pin, RotateCw, X } from 'lucide-react';
import { IconButton, Input, cn, tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import type { BrowserPaneModel } from '../../types';

const DANGER_BORDER = tintClasses('danger').border;

type Props = {
  readonly model: BrowserPaneModel;
  readonly isAddressShortcutOn: boolean;
  readonly isListOpen?: boolean;
  readonly onToggleList?: () => void;
  readonly onClose?: () => void;
};

export const BrowserAddressRow = ({
  model,
  isAddressShortcutOn,
  isListOpen = false,
  onToggleList,
  onClose,
}: Props) => {
  const [draft, setDraft] = useState<string | null>(null);
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const isEmpty = model.shown === null;
  const canStep = model.shown !== null;
  const value = draft ?? model.address;
  const shownId = model.shown?.tab.id ?? null;

  useShortcut(
    'browser.address',
    () => fieldRef.current?.focus({ preventScroll: true }),
    isAddressShortcutOn,
  );

  useEffect(() => {
    setDraft(null);
  }, [shownId]);

  useEffect(() => {
    if (!isEmpty) {
      return;
    }
    setDraft(null);
    fieldRef.current?.focus({ preventScroll: true });
  }, [isEmpty, model.isDrafting]);

  const submitAddress = async (): Promise<void> => {
    const isDone = await model.submit({ text: value });
    if (!isDone) {
      return;
    }
    setDraft(null);
    fieldRef.current?.blur();
  };

  return (
    <div className="flex shrink-0 items-center gap-1 px-2 pt-2">
      {onToggleList === undefined ? null : (
        <IconButton
          icon={PanelLeft}
          label={isListOpen ? 'Hide tab list' : 'Show tab list'}
          aria-pressed={isListOpen}
          variant="ghost"
          tooltipSide="top"
          onClick={onToggleList}
        />
      )}
      <IconButton
        icon={ArrowLeft}
        label="Back"
        variant="ghost"
        tooltipSide="top"
        disabled={!canStep}
        onClick={model.back}
      />
      <IconButton
        icon={ArrowRight}
        label="Forward"
        variant="ghost"
        tooltipSide="top"
        disabled={!canStep}
        onClick={model.forward}
      />
      <IconButton
        icon={RotateCw}
        label="Reload"
        variant="ghost"
        tooltipSide="top"
        disabled={!canStep}
        onClick={model.reload}
      />
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
          className={cn('text-code', model.error !== null && DANGER_BORDER)}
        />
      </form>
      {model.shown === null || model.projectName === null ? null : (
        <IconButton
          icon={Pin}
          label={
            model.shown.isPin ? `Unpin from ${model.projectName}` : `Pin to ${model.projectName}`
          }
          aria-pressed={model.shown.isPin}
          variant="ghost"
          tooltipSide="top"
          onClick={model.togglePin}
        />
      )}
      <IconButton
        icon={CONCEPT_ICONS.openExternal}
        label="Open in your browser"
        variant="ghost"
        tooltipSide="top"
        disabled={model.address === ''}
        onClick={model.openOutside}
      />
      {onClose === undefined ? null : (
        <IconButton icon={X} label="Close" variant="ghost" tooltipSide="top" onClick={onClose} />
      )}
    </div>
  );
};
