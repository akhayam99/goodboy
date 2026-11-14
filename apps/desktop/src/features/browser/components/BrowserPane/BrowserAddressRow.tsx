import { ArrowLeft, ArrowRight, PanelLeft, Pin, RotateCw, Square, Terminal, X } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import { useBrowserKeys } from '../../hooks/useBrowserKeys';
import { useCommandField } from '../../hooks/useCommandField';
import { useFindInPage } from '../../hooks/useFindInPage';
import type { BrowserPaneModel } from '../../types';
import { BrowserAddressPill } from './BrowserAddressPill';
import { BrowserCommandPanel } from './BrowserCommandPanel';
import { BrowserFindBar } from './BrowserFindBar';
import { BrowserLoadLine } from './BrowserLoadLine';
import { BrowserMoreMenu } from './BrowserMoreMenu';

type ConsoleToggle = {
  readonly isOpen: boolean;
  readonly onToggle: () => void;
};

type Props = {
  readonly model: BrowserPaneModel;
  readonly isAddressShortcutOn: boolean;
  readonly isListOpen?: boolean;
  readonly consoleToggle?: ConsoleToggle;
  readonly onToggleList?: () => void;
  readonly onOpenAsPage?: () => void;
  readonly onClose?: () => void;
};

export const BrowserAddressRow = ({
  model,
  isAddressShortcutOn,
  isListOpen = false,
  consoleToggle,
  onToggleList,
  onOpenAsPage,
  onClose,
}: Props) => {
  const canStep = model.shown !== null;
  const field = useCommandField({ model });
  const find = useFindInPage({ model });
  useBrowserKeys({ model, isOn: isAddressShortcutOn, onFind: find.open });
  useShortcut(
    'browser.console',
    () => {
      if (consoleToggle === undefined || model.shown === null) {
        return false;
      }
      consoleToggle.onToggle();
      return true;
    },
    isAddressShortcutOn && consoleToggle !== undefined,
    { canDecline: true },
  );
  return (
    <>
      <div data-grid-row="1" className="relative flex h-10 shrink-0 items-center gap-1 px-2">
        {onToggleList === undefined ? null : (
          <IconButton
            icon={PanelLeft}
            label={isListOpen ? 'Hide tab list' : 'Show tab list'}
            aria-pressed={isListOpen}
            tooltipSide="top"
            onClick={onToggleList}
          />
        )}
        <IconButton
          icon={ArrowLeft}
          label="Back"
          tooltipSide="top"
          disabled={!canStep || !model.canGoBack}
          onClick={model.back}
        />
        <IconButton
          icon={ArrowRight}
          label="Forward"
          tooltipSide="top"
          disabled={!canStep || !model.canGoForward}
          onClick={model.forward}
        />
        {model.isLoading ? (
          <IconButton icon={Square} label="Stop" tooltipSide="top" onClick={model.stop} />
        ) : (
          <IconButton
            icon={RotateCw}
            label="Reload"
            tooltipSide="top"
            disabled={!canStep}
            onClick={model.reload}
          />
        )}
        <BrowserAddressPill model={model} field={field} isAddressShortcutOn={isAddressShortcutOn} />
        {model.shown === null || model.projectName === null ? null : (
          <IconButton
            icon={Pin}
            label={
              model.shown.isPin ? `Unpin from ${model.projectName}` : `Pin to ${model.projectName}`
            }
            aria-pressed={model.shown.isPin}
            shortcut="browser.pin"
            tooltipSide="top"
            onClick={model.togglePin}
          />
        )}
        <BrowserMoreMenu model={model} onOpenAsPage={onOpenAsPage} />
        {consoleToggle === undefined ? null : (
          <IconButton
            icon={Terminal}
            label="Console"
            aria-pressed={consoleToggle.isOpen}
            shortcut="browser.console"
            tooltipSide="top"
            disabled={!canStep}
            onClick={consoleToggle.onToggle}
          />
        )}
        {onClose === undefined ? null : (
          <IconButton icon={X} label="Close" tooltipSide="top" onClick={onClose} />
        )}
        {model.isLoading ? <BrowserLoadLine /> : null}
      </div>
      {field.isOpen ? <BrowserCommandPanel model={model} field={field} /> : null}
      {find.isOpen ? <BrowserFindBar find={find} /> : null}
    </>
  );
};
