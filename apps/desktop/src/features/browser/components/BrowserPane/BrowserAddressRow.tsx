import { ArrowLeft, ArrowRight, PanelLeft, Pin, RotateCw, Square, X } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import { useCommandField } from '../../hooks/useCommandField';
import type { BrowserPaneModel } from '../../types';
import { BrowserAddressPill } from './BrowserAddressPill';
import { BrowserCommandPanel } from './BrowserCommandPanel';
import { BrowserLoadLine } from './BrowserLoadLine';
import { BrowserMoreMenu } from './BrowserMoreMenu';

type Props = {
  readonly model: BrowserPaneModel;
  readonly isAddressShortcutOn: boolean;
  readonly isListOpen?: boolean;
  readonly onToggleList?: () => void;
  readonly onOpenAsPage?: () => void;
  readonly onClose?: () => void;
};

export const BrowserAddressRow = ({
  model,
  isAddressShortcutOn,
  isListOpen = false,
  onToggleList,
  onOpenAsPage,
  onClose,
}: Props) => {
  const canStep = model.shown !== null;
  const field = useCommandField({ model });
  return (
    <>
      <div className="relative flex h-9 shrink-0 items-center gap-1 px-2">
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
            tooltipSide="top"
            onClick={model.togglePin}
          />
        )}
        <BrowserMoreMenu model={model} onOpenAsPage={onOpenAsPage} />
        {onClose === undefined ? null : (
          <IconButton icon={X} label="Close" tooltipSide="top" onClick={onClose} />
        )}
        {model.isLoading ? <BrowserLoadLine /> : null}
      </div>
      {field.isOpen ? <BrowserCommandPanel model={model} field={field} /> : null}
    </>
  );
};
